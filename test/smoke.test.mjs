/**
 * dsh-fofatoto local smoke tests.
 *
 * Run: node --test test/
 * Live API checks (cost quota) run only when FOFA_TEST_KEY is set:
 *   $env:FOFA_TEST_KEY='...'; $env:FOFA_TEST_BASE='https://fafaapi.info'; node --test test/
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { __test } from '../index.js';

const {
  DEFAULT_FIELDS,
  DEFAULT_FIELD_LIST,
  accountSummary,
  apiFieldsFor,
  buildUrl,
  combineSignals,
  csvCell,
  dedupKey,
  expandAccountEndpoint,
  exportSummary,
  fetchAccount,
  fetchInto,
  formatFofaTime,
  inferDomainFromHost,
  metaPathOf,
  normalizeAccountPayload,
  normalizeBaseUrl,
  normalizeConfig,
  openSink,
  parseFofaTime,
  parseRows,
  readExportMeta,
  registerRoutes,
  registerTools,
  renderAccount,
  renderExport,
  renderSearch,
  detectAccountEndpoint,
  retrySleepSeconds,
  sanitizeFileName,
  saveEndpointConfig,
  scalarOrNull,
  searchPage,
  searchSummary,
  textOrEmpty,
  txtMode,
  writeExportMeta,
} = __test;

/** Run a test body inside a throwaway directory. */
async function withTempDir(body) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-fofatoto-test-'));
  try {
    return await body(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Split one tool render into its optional summary line and JSON body.
 * The contract is `<summary>\n<compact JSON>`; a summary-less body parses whole.
 * @param {string} text rendered tool content
 * @returns {{ summary: string, value: unknown }} parsed parts
 */
function renderParts(text) {
  const index = text.indexOf('\n{');
  if (index === -1) return { summary: '', value: JSON.parse(text) };
  return { summary: text.slice(0, index), value: JSON.parse(text.slice(index + 1)) };
}

/**
 * Minimal validator for the enforced raw JSON Schema subset DSH applies to
 * `output.schema` (type/properties/required/additionalProperties/items/enum/
 * const/oneOf). Mirrors the registry so tests fail when a tool returns a value
 * its own schema rejects — the class of bug that made `fofa_export` fail.
 * @param {object} schema declared output schema
 * @param {unknown} value candidate canonical value
 * @param {string} path diagnostic path
 * @returns {string[]} violations; empty means valid
 */
function schemaViolations(schema, value, path = 'value') {
  const violations = [];
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) return [`${path} schema is not an object`];
  if (Object.hasOwn(schema, 'oneOf')) {
    const matched = schema.oneOf.filter((branch) => schemaViolations(branch, value, path).length === 0).length;
    if (matched !== 1) violations.push(`${path} must match exactly one oneOf branch (matched ${matched})`);
    return violations;
  }
  if (Object.hasOwn(schema, 'enum') && !schema.enum.includes(value)) violations.push(`${path} must be one of ${JSON.stringify(schema.enum)}`);
  if (Object.hasOwn(schema, 'const') && value !== schema.const) violations.push(`${path} must be ${JSON.stringify(schema.const)}`);
  if (!Object.hasOwn(schema, 'type')) return violations;
  switch (schema.type) {
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        violations.push(`${path} must be an object`);
        break;
      }
      const properties = schema.properties ?? {};
      for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) violations.push(`${path}.${key} is required`);
      for (const [key, child] of Object.entries(properties)) {
        if (Object.hasOwn(value, key)) violations.push(...schemaViolations(child, value[key], `${path}.${key}`));
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) violations.push(`${path}.${key} is not a declared property`);
      }
      break;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        violations.push(`${path} must be an array`);
        break;
      }
      if (schema.items !== undefined) {
        value.forEach((item, index) => violations.push(...schemaViolations(schema.items, item, `${path}[${index}]`)));
      }
      break;
    }
    case 'string':
      if (typeof value !== 'string') violations.push(`${path} must be a string`);
      break;
    case 'integer':
      if (!Number.isInteger(value)) violations.push(`${path} must be an integer`);
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) violations.push(`${path} must be a number`);
      break;
    case 'boolean':
      if (typeof value !== 'boolean') violations.push(`${path} must be a boolean`);
      break;
    case 'null':
      if (value !== null) violations.push(`${path} must be null`);
      break;
    default:
      violations.push(`${path} has unsupported type ${JSON.stringify(schema.type)}`);
  }
  return violations;
}

/* ---------------------------------------------------------------- */
/* Field handling                                                    */
/* ---------------------------------------------------------------- */

test('url is stripped from API fields and its inputs are ensured', () => {
  assert.equal(apiFieldsFor('ip,port'), 'ip,port');
  assert.equal(apiFieldsFor('url'), 'host,ip,port,protocol');
  assert.equal(apiFieldsFor('url,title'), 'title,host,ip,port,protocol');
  assert.equal(apiFieldsFor('host,url,ip,port,protocol'), 'host,ip,port,protocol');
});

test('parseRows aligns arrays, infers domain and synthesizes url', () => {
  const rows = parseRows(
    [
      ['https://a.example.com', '1.2.3.4', '443', 'https', '', 'Title', 'nginx'],
      ['1.2.3.5:8080', '1.2.3.5', '8080', '', '', '', ''],
    ],
    ['host', 'ip', 'port', 'protocol', 'domain', 'title', 'server'],
    ['host', 'ip', 'port', 'protocol', 'domain', 'title', 'server', 'url'],
  );
  assert.equal(rows[0].domain, 'a.example.com');
  assert.equal(rows[0].url, 'https://a.example.com');
  assert.equal(rows[1].domain, '');
  assert.equal(rows[1].url, 'http://1.2.3.5:8080');
});

/* ---------------------------------------------------------------- */
/* URL building                                                      */
/* ---------------------------------------------------------------- */

test('buildUrl mirrors fofatoto', () => {
  assert.equal(buildUrl({ host: 'https://x', port: '443', protocol: 'https' }), 'https://x');
  assert.equal(buildUrl({ host: 'example.com', port: '80', protocol: 'http' }), 'http://example.com');
  assert.equal(buildUrl({ host: 'example.com', port: '443', protocol: 'https' }), 'https://example.com');
  assert.equal(buildUrl({ host: 'example.com', port: '8443', protocol: 'https' }), 'https://example.com:8443');
  assert.equal(buildUrl({ host: 'example.com', port: '443', protocol: '' }), 'https://example.com');
  assert.equal(buildUrl({ host: 'example.com:9090', port: '9090', protocol: 'http' }), 'http://example.com:9090');
  // fofatoto keeps the first protocol token, so a dirty "http,https" stays http.
  assert.equal(buildUrl({ host: 'example.com', port: '443', protocol: 'http,https' }), 'http://example.com:443');
  assert.equal(buildUrl({ host: '', port: '443', protocol: 'https' }), '');
  assert.equal(inferDomainFromHost('1.2.3.4'), '');
  assert.equal(inferDomainFromHost('https://a.b.example.com:8443/x'), 'a.b.example.com');
});

/* ---------------------------------------------------------------- */
/* Time cursor                                                       */
/* ---------------------------------------------------------------- */

test('FOFA time cursor round-trips and steps one second', () => {
  const epoch = parseFofaTime('2026-10-08 11:22:18');
  assert.equal(epoch, Date.UTC(2026, 9, 8, 11, 22, 18));
  assert.equal(formatFofaTime(epoch - 1000), '2026-10-08 11:22:17');
  assert.equal(parseFofaTime('not-a-time'), null);
});

/* ---------------------------------------------------------------- */
/* Incremental export sink                                           */
/* ---------------------------------------------------------------- */

test('CSV sink writes one BOM+header and appends every batch', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'out.csv');
    const sink = await openSink({ path, format: 'csv', columns: ['host', 'title'], mode: 'url' });
    await sink.writeRows([{ host: 'a', title: 'x,y' }, { host: 'b', title: 'z' }]);
    await sink.writeRows([{ host: 'c', title: '' }]);
    await sink.close();
    assert.equal(sink.count, 3);
    const text = await readFile(path, 'utf8');
    assert.equal(text.charCodeAt(0), 0xfeff);
    const lines = text.trimEnd().split('\r\n');
    assert.equal(lines[0], '\uFEFFhost,title');
    assert.equal(lines.length, 4);
    assert.equal(text.includes('"x,y"'), true);
  });
});

test('JSON sink always leaves a parseable file', async () => {
  await withTempDir(async (dir) => {
    const withRows = join(dir, 'rows.json');
    const sink = await openSink({ path: withRows, format: 'json', columns: ['host', 'ip'], mode: 'url' });
    await sink.writeRows([{ host: 'a', ip: '1' }]);
    await sink.writeRows([{ host: 'b', ip: '2' }]);
    await sink.close();
    assert.deepEqual(JSON.parse(await readFile(withRows, 'utf8')), [{ host: 'a', ip: '1' }, { host: 'b', ip: '2' }]);

    const empty = join(dir, 'empty.json');
    const emptySink = await openSink({ path: empty, format: 'json', columns: ['host'], mode: 'url' });
    await emptySink.close();
    assert.deepEqual(JSON.parse(await readFile(empty, 'utf8')), []);
  });
});

test('TXT sink picks ip/domain/url mode and drops empty lines', async () => {
  await withTempDir(async (dir) => {
    const ipPath = join(dir, 'ip.txt');
    const ipSink = await openSink({ path: ipPath, format: 'txt', columns: ['ip'], mode: txtMode(['ip']) });
    await ipSink.writeRows([{ ip: '1.1.1.1' }, { ip: '' }, { ip: '2.2.2.2' }]);
    await ipSink.close();
    assert.equal(await readFile(ipPath, 'utf8'), '1.1.1.1\n2.2.2.2\n');

    const urlPath = join(dir, 'url.txt');
    const urlSink = await openSink({ path: urlPath, format: 'txt', columns: ['url'], mode: txtMode(['url']) });
    await urlSink.writeRows([{ host: 'h', port: '443', protocol: 'https' }, { ip: '9.9.9.9' }]);
    await urlSink.close();
    assert.equal(await readFile(urlPath, 'utf8'), 'https://h\n9.9.9.9\n');
  });
});

test('resume appends after the header and keeps the meta sidecar', async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, 'out.csv');
    const first = await openSink({ path, format: 'csv', columns: ['host'], mode: 'url' });
    await first.writeRows([{ host: 'a' }]);
    await first.close();
    await writeExportMeta(path, {
      format: 'csv',
      query: 'domain="example.com"',
      fields: 'host',
      columns: ['host'],
      mode: 'url',
      dedup: '',
      total: 3,
      written: 1,
      nextBefore: '2026-10-01 00:00:00',
      partial: true,
      stoppedReason: 'time-budget',
    });
    const meta = await readExportMeta(path);
    assert.equal(meta.written, 1);
    assert.equal(meta.nextBefore, '2026-10-01 00:00:00');
    assert.equal(metaPathOf(path), `${path}.meta.json`);

    const second = await openSink({ path, format: 'csv', columns: meta.columns, mode: meta.mode, append: true, initialCount: meta.written });
    await second.writeRows([{ host: 'b' }]);
    await second.close();
    assert.equal(second.count, 2);
    const lines = (await readFile(path, 'utf8')).trimEnd().split('\r\n');
    assert.deepEqual(lines, ['\uFEFFhost', 'a', 'b']);
  });
});

test('JSON cannot resume and a missing sidecar explains why', async () => {
  await withTempDir(async (dir) => {
    await assert.rejects(
      () => openSink({ path: join(dir, 'a.json'), format: 'json', columns: ['host'], mode: 'url', append: true }),
      /JSON 不支持断点续拉/u,
    );
    await assert.rejects(() => readExportMeta(join(dir, 'missing.csv')), /可分片续拉的导出/u);
  });
});

test('dedup key follows url synthesis and column order', () => {
  assert.equal(dedupKey({ host: 'h', port: '443', protocol: 'https' }, ['url']), 'https://h');
  assert.equal(dedupKey({ ip: '1' }, ['ip', 'host']), '1\u0001');
  assert.equal(csvCell('plain'), 'plain');
});

test('combined signals abort with the first reason', () => {
  const first = new AbortController();
  const second = new AbortController();
  const fused = combineSignals([first.signal, second.signal]);
  assert.equal(fused.aborted, false);
  first.abort(new Error('cancelled'));
  assert.equal(fused.aborted, true);
  assert.equal(combineSignals([undefined, null]), undefined);
});

test('export file names stay inside the directory', () => {
  assert.equal(sanitizeFileName('../../evil'), 'evil');
  assert.equal(sanitizeFileName('a/b:c.csv'), 'b_c');
  assert.equal(sanitizeFileName(''), sanitizeFileName(''));
});

/* ---------------------------------------------------------------- */
/* Timeout / resume semantics (fake search, no quota)                */
/* ---------------------------------------------------------------- */

/** Build `count` synthetic FOFA rows all stamped at one minute. */
function fakeRows(count, minute) {
  return Array.from({ length: count }, (_value, index) => ({
    host: `h${minute}-${index}.example.com`,
    lastupdatetime: `2026-10-28 10:${String(minute).padStart(2, '0')}:00`,
  }));
}

test('time budget stops after a written batch without losing rows', async () => {
  const calls = [];
  const fakeSearch = async (options) => {
    calls.push(options);
    if (options.size === 1) return { total: 25000, rows: fakeRows(1, 59), httpStatus: 200, attempts: 1 };
    if (calls.length === 2) return { total: 25000, rows: fakeRows(10000, 50), httpStatus: 200, attempts: 1 };
    return { total: 25000, rows: fakeRows(10000, 40), httpStatus: 200, attempts: 1 };
  };
  await withTempDir(async (dir) => {
    const path = join(dir, 'budget.csv');
    const sink = await openSink({ path, format: 'csv', columns: ['host'], mode: 'url' });
    const budget = new AbortController();
    const summary = await fetchInto({
      config: normalizeConfig({ rateLimitSeconds: 0, maxExportRows: 50000 }),
      key: 'k',
      query: 'domain="example.com"',
      limit: 0,
      fill: 1,
      columns: ['host'],
      sink,
      full: false,
      signal: undefined,
      budgetSignal: budget.signal,
      startBefore: '',
      knownTotal: 0,
      searchImpl: fakeSearch,
      onPage: ({ batches }) => {
        if (batches === 1) budget.abort(new Error('budget exhausted'));
      },
    });
    await sink.close();
    assert.equal(summary.partial, true);
    assert.equal(summary.stoppedReason, 'time-budget');
    assert.equal(sink.count, 10000);
    assert.equal(summary.nextBefore, '2026-10-28 10:49:59');
    const lines = (await readFile(path, 'utf8')).trimEnd().split('\r\n');
    assert.equal(lines.length, 10001);
  });
});

test('resume skips the count query and starts from the saved cursor', async () => {
  const calls = [];
  const fakeSearch = async (options) => {
    calls.push(options);
    return { total: 0, rows: fakeRows(2, 49), httpStatus: 200, attempts: 1 };
  };
  await withTempDir(async (dir) => {
    const path = join(dir, 'resume.csv');
    const sink = await openSink({ path, format: 'csv', columns: ['host'], mode: 'url', append: true, initialCount: 3 });
    const summary = await fetchInto({
      config: normalizeConfig({ rateLimitSeconds: 0, maxExportRows: 50000 }),
      key: 'k',
      query: 'domain="example.com"',
      limit: 2,
      fill: 1,
      columns: ['host'],
      sink,
      full: false,
      signal: undefined,
      budgetSignal: undefined,
      startBefore: '2026-10-28 10:50:00',
      knownTotal: 5000,
      searchImpl: fakeSearch,
    });
    await sink.close();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].size, 2);
    assert.equal(calls[0].query, 'domain="example.com" && before="2026-10-28 10:50:00"');
    assert.equal(sink.count, 5);
    assert.equal(summary.total, 5000);
    assert.equal(summary.stoppedReason, 'limit');
  });
});

test('retry backoff honors the relay wait hint', () => {
  assert.equal(retrySleepSeconds(new Error('请求过于频繁，请5秒后再试'), 1), 6);
  assert.equal(retrySleepSeconds(new Error('[-501] 服务错误'), 1), 10);
  assert.equal(retrySleepSeconds(new Error('plain failure'), 2), 4);
});

test('tool renders keep the canonical value parseable behind a summary line', () => {
  const accountValue = {
    httpStatus: 200,
    source: 'credential',
    account: {
      type: 'relay',
      valid: true,
      vip: false,
      todayRemaining: 91,
      remainApiQuery: '不限',
      expiration: '2026-12-01 00:00:00',
      firstUsed: '',
      vipLevel: null,
      server: null,
      baseUrl: 'https://fafaapi.info',
    },
  };
  assert.equal(accountSummary(accountValue), '中转站 · Key 有效 · 今日剩余 91 · 剩余查询 不限 · 到期 2026-12-01 00:00:00');
  const account = renderParts(renderAccount(accountValue));
  assert.deepEqual(account.value, accountValue);
  assert.equal(renderAccount(accountValue).split('\n').length, 2);

  const fields = 'host,ip,port,protocol,domain,title';
  const rows = parseRows(
    [
      ['https://a.example.com', '1.2.3.4', '443', 'https', '', 'Title A'],
      ['1.2.3.5:8080', '1.2.3.5', '8080', '', '', ''],
    ],
    fields.split(','),
    fields.split(','),
  );
  const searchValue = { query: 'domain="example.com"', total: 67, page: 1, size: 2, fields, uniqueIps: 1, rows };
  assert.equal(searchSummary(searchValue), '命中 67 条 · 本页 2 条 · 去重 IP 1');
  assert.deepEqual(renderParts(renderSearch(searchValue)).value, searchValue);

  const exportValue = {
    path: 'fofa-output/x.csv',
    metaPath: 'fofa-output/x.csv.meta.json',
    format: 'csv',
    query: 'domain="example.com"',
    total: 1,
    written: 1,
    newRows: 1,
    rowsFetched: 1,
    apiCalls: 1,
    batches: 1,
    partial: false,
    stoppedReason: 'exhausted',
    nextBefore: null,
    durationMs: 1000,
    resumed: false,
    dedup: '',
    fields: 'host',
    budgetSeconds: 240,
  };
  assert.equal(exportSummary(exportValue), '导出完成 · csv · 1 行 → fofa-output/x.csv');
  assert.deepEqual(renderParts(renderExport(exportValue)).value, exportValue);

  const partialValue = {
    ...exportValue,
    total: 25000,
    written: 10000,
    partial: true,
    stoppedReason: 'time-budget',
    nextBefore: '2026-10-28 10:49:59',
  };
  assert.equal(
    exportSummary(partialValue),
    '导出未完成（time-budget） · csv · 10000 行 · 总匹配 25000 → fofa-output/x.csv（可 appendTo 续拉）',
  );
  assert.match(renderExport(partialValue), /^导出未完成/u);
});

test('default fields exclude server and stay configurable', () => {
  assert.deepEqual(DEFAULT_FIELD_LIST, ['host', 'ip', 'port', 'protocol', 'domain', 'title']);
  assert.equal(DEFAULT_FIELDS, 'host,ip,port,protocol,domain,title');
  assert.equal(DEFAULT_FIELDS.includes('server'), false);
  assert.equal(normalizeConfig({}).defaultFields, DEFAULT_FIELDS);
  assert.equal(normalizeConfig({ defaultFields: 'host,server' }).defaultFields, 'host,server');
});

test('registered tools render their own output without throwing', () => {
  const registered = new Map();
  const ctx = {
    tools: {
      register: (tool) => {
        registered.set(tool.name, tool);
        return () => {};
      },
    },
    effect: (fn) => {
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    get: () => undefined,
    inject: () => {},
  };
  assert.deepEqual(registerTools(ctx, normalizeConfig({})), ['fofa_account', 'fofa_search', 'fofa_export']);
  const accountValue = {
    httpStatus: 200,
    source: 'config',
    account: { type: 'standard', valid: true, baseUrl: 'https://fofa.info' },
  };
  const account = registered.get('fofa_account').output.render({}, accountValue);
  assert.equal(account[0].type, 'text');
  assert.deepEqual(renderParts(account[0].text).value, accountValue);
  const searchValue = {
    query: 'domain="example.com"',
    total: 1,
    page: 1,
    size: 50,
    fields: 'host,title',
    uniqueIps: 1,
    rows: [{ host: 'a.example.com', title: 'A' }],
  };
  const search = registered.get('fofa_search').output.render({}, searchValue);
  assert.deepEqual(renderParts(search[0].text).value, searchValue);
  const exportValue = {
    path: 'fofa-output/x.csv',
    metaPath: 'fofa-output/x.csv.meta.json',
    format: 'csv',
    query: 'domain="example.com"',
    total: 1,
    written: 1,
    newRows: 1,
    rowsFetched: 1,
    apiCalls: 1,
    partial: false,
    stoppedReason: 'exhausted',
    nextBefore: '',
    durationMs: 1000,
    resumed: false,
    dedup: '',
    fields: 'host',
    budgetSeconds: 240,
  };
  const exported = registered.get('fofa_export').output.render({}, exportValue);
  assert.deepEqual(renderParts(exported[0].text).value, exportValue);
});

/* ---------------------------------------------------------------- */
/* End-to-end tool execution (mocked FOFA API)                       */
/* ---------------------------------------------------------------- */

test('tools execute end to end against a mocked FOFA API', async () => {
  const realFetch = globalThis.fetch;
  const valueFor = (field) => {
    switch (field) {
      case 'host': return 'a.example.com';
      case 'ip': return '1.2.3.4';
      case 'port': return '443';
      case 'protocol': return 'https';
      case 'domain': return 'example.com';
      case 'title': return 'Example';
      case 'lastupdatetime': return '2026-10-29 10:00:00';
      default: return '';
    }
  };
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const json = (payload) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
    if (url.pathname.endsWith('/fofaapi/v1/validate-key')) {
      return json({ valid: true, todayRemaining: 12, totalRemaining: '不限', expireTime: '2026-12-01 00:00:00', firstUsedAt: '2026-10-01 00:00:00' });
    }
    if (url.pathname.endsWith('/api/v1/search/all')) {
      const fields = (url.searchParams.get('fields') ?? '').split(',').filter((field) => field !== '');
      return json({ size: 1, results: [fields.map(valueFor)], page: 1, mode: 'extended' });
    }
    return json({ error: true, errmsg: `unexpected path ${url.pathname}` });
  };
  const makeCtx = (sink) => ({
    tools: {
      register: (tool) => {
        sink.set(tool.name, tool);
        return () => {};
      },
    },
    effect: (fn) => {
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    get: () => undefined,
    inject: () => {},
  });
  try {
    const tools = new Map();
    const config = normalizeConfig({ baseUrl: 'https://fafaapi.info', apiKey: 'test-key', rateLimitSeconds: 0, maxExportSeconds: 5 });
    registerTools(makeCtx(tools), config);
    const exec = { signal: new AbortController().signal };

    const accountValue = await tools.get('fofa_account').execute({}, exec);
    assert.equal(accountValue.source, 'config');
    assert.equal(accountValue.account.type, 'relay');
    assert.equal(accountValue.account.valid, true);
    assert.deepEqual(renderParts(tools.get('fofa_account').output.render({}, accountValue)[0].text).value, accountValue);

    const searchValue = await tools.get('fofa_search').execute({ query: 'domain="example.com"', size: 1 }, exec);
    assert.equal(searchValue.total, 1);
    assert.equal(searchValue.fields, DEFAULT_FIELDS);
    assert.equal(searchValue.uniqueIps, 1);
    assert.equal(searchValue.rows.length, 1);
    assert.equal(searchValue.rows[0].host, 'a.example.com');
    assert.deepEqual(renderParts(tools.get('fofa_search').output.render({}, searchValue)[0].text).value, searchValue);

    await withTempDir(async (dir) => {
      const exportTools = new Map();
      const exportConfig = normalizeConfig({
        baseUrl: 'https://fafaapi.info',
        apiKey: 'test-key',
        outputDir: dir,
        rateLimitSeconds: 0,
        maxExportSeconds: 5,
      });
      registerTools(makeCtx(exportTools), exportConfig);
      const exportValue = await exportTools.get('fofa_export').execute(
        { query: 'domain="example.com"', limit: 2, format: 'csv', fields: 'host,ip' },
        exec,
      );
      assert.equal(exportValue.format, 'csv');
      assert.equal(exportValue.written, 1);
      assert.equal(exportValue.newRows, 1);
      assert.equal(exportValue.stoppedReason, 'complete');
      assert.equal(exportValue.path.startsWith(dir), true);
      const body = await readFile(exportValue.path, 'utf8');
      assert.equal(body.split('\r\n').filter((line) => line !== '').length, 2);
      assert.deepEqual(renderParts(exportTools.get('fofa_export').output.render({}, exportValue)[0].text).value, exportValue);
    });

    const emptyTools = new Map();
    registerTools(
      makeCtx(emptyTools),
      normalizeConfig({ baseUrl: 'https://fofa.info', apiKey: '', apiKeyEnv: 'DSH_FOFA_AUDIT_MISSING_KEY', fofatotoConfigPath: '' }),
    );
    await assert.rejects(emptyTools.get('fofa_account').execute({}, exec), /尚未配置 FOFA API Key/u);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('every tool value satisfies its declared output.schema across export stop reasons', async () => {
  const realFetch = globalThis.fetch;
  const calls = { search: 0 };
  let plan = { countQuery: false, total: 0, pages: [] };
  const jsonResponse = (payload) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
  const fieldValue = (field, index) =>
    ({
      host: `h${index}.example.com`,
      ip: `10.0.0.${index}`,
      port: '443',
      protocol: 'https',
      domain: 'example.com',
      title: 'Example',
      lastupdatetime: '2026-10-29 10:00:00',
    })[field] ?? '';
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/fofaapi/v1/validate-key')) {
      return jsonResponse({
        valid: true,
        todayRemaining: 12,
        totalRemaining: '不限',
        expireTime: '2026-10-30 00:00:00',
        firstUsedAt: '2026-10-01 00:00:00',
        fofa_server: true,
      });
    }
    if (url.pathname.endsWith('/api/v1/search/all')) {
      calls.search += 1;
      const fields = (url.searchParams.get('fields') ?? '').split(',').filter((field) => field !== '');
      if (calls.search === 1 && plan.countQuery) return jsonResponse({ size: plan.total, results: [], page: 1 });
      const page = plan.pages.shift() ?? [];
      return jsonResponse({
        size: plan.total,
        results: page.map((index) => fields.map((field) => fieldValue(field, index))),
        page: 1,
      });
    }
    return jsonResponse({ error: true, errmsg: 'unexpected' });
  };

  const exec = { signal: new AbortController().signal };
  const makeCtx = (sink) => ({
    tools: {
      register: (tool) => {
        sink.set(tool.name, tool);
        return () => {};
      },
    },
    effect: (fn) => {
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    get: () => undefined,
    inject: () => {},
  });
  const register = (dir = '') => {
    const tools = new Map();
    registerTools(
      makeCtx(tools),
      normalizeConfig({ baseUrl: 'https://fafaapi.info', apiKey: 'test-key', outputDir: dir, rateLimitSeconds: 0, maxExportSeconds: 5 }),
    );
    return tools;
  };
  /** Assert the canonical value and the rendered JSON body agree with the declared schema. */
  const assertSchema = (tools, name, value) => {
    const tool = tools.get(name);
    assert.deepEqual(schemaViolations(tool.output.schema, value), [], `${name} value must satisfy its output.schema`);
    assert.deepEqual(renderParts(tool.output.render({}, value)[0].text).value, value, `${name} render must embed the value`);
  };

  try {
    const accountTools = register();
    assertSchema(accountTools, 'fofa_account', await accountTools.get('fofa_account').execute({}, exec));

    calls.search = 0;
    plan = { countQuery: false, total: 2, pages: [[0, 1]] };
    const searchTools = register();
    assertSchema(
      searchTools,
      'fofa_search',
      await searchTools.get('fofa_search').execute({ query: 'domain="example.com"', size: 2 }, exec),
    );

    // Regression: a short final page returns nextBefore = null and used to fail
    // the registry's INVALID_TOOL_OUTPUT check after the file was already written.
    await withTempDir(async (dir) => {
      calls.search = 0;
      plan = { countQuery: true, total: 3, pages: [[0]] };
      const tools = register(dir);
      const value = await tools.get('fofa_export').execute({ query: 'domain="example.com"', format: 'csv', fields: 'host,ip' }, exec);
      assert.equal(value.nextBefore, null, 'exhausted export returns a null cursor');
      assertSchema(tools, 'fofa_export', value);
    });

    // Zero results still returns a usable (empty) file and a null cursor.
    await withTempDir(async (dir) => {
      calls.search = 0;
      plan = { countQuery: true, total: 0, pages: [] };
      const tools = register(dir);
      const value = await tools.get('fofa_export').execute({ query: 'domain="example.com"', format: 'csv', fields: 'host,ip' }, exec);
      assert.equal(value.stoppedReason, 'empty');
      assertSchema(tools, 'fofa_export', value);
    });

    // A limit stop keeps a live string cursor for appendTo resumption.
    await withTempDir(async (dir) => {
      calls.search = 0;
      plan = { countQuery: true, total: 10, pages: [[0, 1]] };
      const tools = register(dir);
      const value = await tools.get('fofa_export').execute(
        { query: 'domain="example.com"', limit: 2, format: 'json', fields: 'host,ip' },
        exec,
      );
      assert.equal(value.stoppedReason, 'limit');
      assert.equal(typeof value.nextBefore, 'string');
      assertSchema(tools, 'fofa_export', value);
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('presentationMeta carries bounded, spill-safe card facts', () => {
  const tools = new Map();
  registerTools(
    {
      tools: {
        register: (tool) => {
          tools.set(tool.name, tool);
          return () => {};
        },
      },
      effect: (fn) => {
        const dispose = fn();
        return typeof dispose === 'function' ? dispose : () => {};
      },
      get: () => undefined,
      inject: () => {},
    },
    normalizeConfig({}),
  );

  const accountMeta = tools.get('fofa_account').output.presentationMeta({}, {
    httpStatus: 200,
    source: 'credential',
    account: { type: 'relay', valid: true, todayRemaining: 91 },
  });
  assert.equal(accountMeta.kind, 'account');
  assert.equal(accountMeta.account.todayRemaining, 91);

  // A 1000-row page: the card facts stay small even though the rendered JSON
  // (and any long field such as banner) would be spilled or huge.
  const rows = Array.from({ length: 1000 }, (_value, index) => ({
    host: `h${index}.example.com`,
    ip: `10.0.0.${index}`,
    port: '443',
    title: 'Example',
    banner: 'x'.repeat(5000),
  }));
  const searchValue = { query: 'domain="baidu.com"', total: 78717, page: 1, size: 1000, fields: 'host,ip,port,title', uniqueIps: 456, rows };
  const searchMeta = tools.get('fofa_search').output.presentationMeta({}, searchValue);
  assert.equal(searchMeta.kind, 'search');
  assert.equal(searchMeta.rowCount, 1000);
  assert.equal(searchMeta.rows.length, 8);
  assert.deepEqual(Object.keys(searchMeta.rows[0]).sort(), ['host', 'ip', 'port', 'title']);
  assert.ok(JSON.stringify(searchMeta).length < 4096, 'search card facts must stay bounded');

  const exportValue = {
    path: 'fofa-output/x.csv',
    metaPath: 'fofa-output/x.csv.meta.json',
    format: 'csv',
    query: 'domain="baidu.com"',
    total: 78717,
    written: 1000,
    newRows: 1000,
    rowsFetched: 1000,
    apiCalls: 2,
    batches: 1,
    partial: false,
    stoppedReason: 'limit',
    nextBefore: '2026-10-29 12:59:59',
    durationMs: 12000,
    resumed: false,
    dedup: 'url',
    fields: 'host,ip,port,title',
    budgetSeconds: 240,
  };
  const exportMeta = tools.get('fofa_export').output.presentationMeta({}, exportValue);
  assert.equal(exportMeta.kind, 'export');
  assert.equal(exportMeta.path, exportValue.path);
  assert.equal(exportMeta.stoppedReason, 'limit');
});

test('account scalars normalize to the number/string/boolean/null contract', () => {
  assert.equal(scalarOrNull(5), 5);
  assert.equal(scalarOrNull('不限'), '不限');
  assert.equal(scalarOrNull(true), true);
  assert.equal(scalarOrNull(null), null);
  assert.equal(scalarOrNull(undefined), null);
  assert.equal(scalarOrNull(Number.NaN), null);
  assert.equal(scalarOrNull({ nested: true }), null);
  assert.equal(textOrEmpty('2026-12-01'), '2026-12-01');
  assert.equal(textOrEmpty(2026), '2026');
  assert.equal(textOrEmpty(null), '');
  assert.equal(textOrEmpty({}), '');
});

test('every test export and tool render hook is defined', () => {
  for (const [name, value] of Object.entries(__test)) {
    assert.notEqual(value, undefined, `__test.${name} is undefined`);
  }
  const tools = new Map();
  registerTools({
    tools: {
      register: (tool) => {
        tools.set(tool.name, tool);
        return () => {};
      },
    },
    effect: (fn) => {
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    get: () => undefined,
    inject: () => {},
  }, normalizeConfig({}));
  for (const [name, tool] of tools) {
    assert.equal(typeof tool.execute, 'function', `${name}.execute`);
    assert.equal(typeof tool.output.render, 'function', `${name}.output.render`);
    assert.equal(typeof tool.output.schema, 'object', `${name}.output.schema`);
    assert.equal(typeof tool.description, 'string', `${name}.description`);
  }
});

/* ---------------------------------------------------------------- */
/* Account endpoint resolution (fofatoto parity)                     */
/* ---------------------------------------------------------------- */

test('account endpoint detection mirrors fofatoto relay table', () => {
  assert.deepEqual(detectAccountEndpoint('https://fafaapi.info'), {
    kind: 'relay',
    template: '{base_url}/fofaapi/v1/validate-key?key={key}',
    relayDomain: 'fafaapi.info',
  });
  // suffix match on a subdomain, same as fofatoto
  assert.equal(detectAccountEndpoint('https://api.fafaapi.info').relayDomain, 'fafaapi.info');
  // official fallback
  assert.equal(detectAccountEndpoint('https://fofa.info').kind, 'official');
  assert.equal(detectAccountEndpoint('https://example.com').kind, 'official');
  // an unparsable base URL falls back to official instead of throwing
  assert.equal(detectAccountEndpoint('not-a-url').kind, 'official');
});

test('endpoint templates expand placeholders and append a missing key', () => {
  const relay = detectAccountEndpoint('https://fafaapi.info');
  assert.equal(
    expandAccountEndpoint(relay, { baseUrl: 'https://fafaapi.info' }, 'k1'),
    'https://fafaapi.info/fofaapi/v1/validate-key?key=k1',
  );
  const official = detectAccountEndpoint('https://fofa.info');
  assert.equal(
    expandAccountEndpoint(official, { baseUrl: 'https://fofa.info' }, 'k2'),
    'https://fofa.info/api/v1/info/my?key=k2',
  );
  // templates without {key} get the key appended as a query parameter
  assert.equal(
    expandAccountEndpoint({ kind: 'relay', template: 'https://x.example/me' }, { baseUrl: 'https://x.example' }, 'k3'),
    'https://x.example/me?key=k3',
  );
  // {base} is accepted as an alias of {base_url}
  assert.equal(
    expandAccountEndpoint({ kind: 'relay', template: '{base}/me?key={key}' }, { baseUrl: 'https://x.example' }, 'k4'),
    'https://x.example/me?key=k4',
  );
  assert.throws(() => expandAccountEndpoint({ kind: 'relay', template: 'ftp://x/y' }, { baseUrl: 'https://x.example' }, 'k'), /http\(s\)/u);
  assert.throws(() => expandAccountEndpoint({ kind: 'relay', template: 'not a url' }, { baseUrl: 'https://x.example' }, 'k'), /模板不合法/u);
});

test('account payload normalization covers relay, official and wrapped shapes', () => {
  const relayTarget = { kind: 'relay', relayDomain: 'fafaapi.info', template: 'https://fafaapi.info/x?key={key}' };
  const relay = normalizeAccountPayload(
    { valid: true, todayRemaining: 77, totalRemaining: '不限', expireTime: '2026-11-08', firstUsedAt: '2026-10-08' },
    relayTarget,
    'https://fafaapi.info',
  );
  assert.equal(relay.type, 'relay');
  assert.equal(relay.valid, true);
  assert.equal(relay.todayRemaining, 77);
  assert.equal(relay.remainApiQuery, '不限');
  assert.equal(relay.expiration, '2026-11-08');
  assert.equal(relay.firstUsed, '2026-10-08');

  const official = normalizeAccountPayload(
    { error: false, isvip: true, remain_api_query: 1234, expiration: '2026-12-01', vip_level: 3, fofa_server: true },
    { kind: 'official', template: '{base_url}/api/v1/info/my?key={key}' },
    'https://fofa.info',
  );
  assert.equal(official.type, 'standard');
  assert.equal(official.valid, true);
  assert.equal(official.remainApiQuery, 1234);
  assert.equal(official.vipLevel, 3);

  const wrapped = normalizeAccountPayload({ code: 0, data: { valid: false, todayRemaining: 5 } }, relayTarget, 'https://relay');
  assert.equal(wrapped.valid, false);
  assert.equal(wrapped.todayRemaining, 5);

  assert.throws(
    () => normalizeAccountPayload({ error: true, errmsg: 'bad key' }, relayTarget, 'x'),
    (error) => error instanceof Error && error.message === '账号信息接口返回失败' && error.fofaError === 'bad key',
  );
  assert.throws(() => normalizeAccountPayload('nope', relayTarget, 'x'), /无法解析/u);
});

test('base url normalization and status shape', () => {
  assert.equal(normalizeBaseUrl('https://fofa.info///', ''), 'https://fofa.info');
  assert.equal(normalizeBaseUrl('ftp://x', ''), '');
  assert.equal(normalizeBaseUrl('   ', ''), '');
  // the account-info endpoint is not a config surface any more
  const config = normalizeConfig({
    baseUrl: 'https://fafaapi.info',
    infoApi: 'https://x/{key}',
    relayInfoApis: { 'x.example': 'https://y/{key}' },
  });
  assert.equal(Object.hasOwn(config, 'infoApi'), false);
  assert.equal(Object.hasOwn(config, 'relayInfoApis'), false);
  const status = __test.buildStatus(config, { key: '', source: 'none' }, true);
  assert.equal(status.baseUrl, 'https://fafaapi.info');
  assert.equal(status.editable, true);
  assert.equal(Object.hasOwn(status, 'accountSource'), false);
});

test('endpoint settings persist through the config editor contract', async () => {
  const calls = [];
  const entry = { options: { id: 'dsh-fofatoto', name: 'dsh-fofatoto', config: { baseUrl: 'https://fofa.info', timeoutMs: 45000 } } };
  const ctx = {
    get: (name) =>
      name === 'configEditor'
        ? {
            entries: () => [entry],
            edit: async (target, change) => {
              calls.push(change(structuredClone(entry.options.config), {}));
            },
          }
        : undefined,
  };
  await saveEndpointConfig(ctx, { baseUrl: 'https://fafaapi.info' });
  assert.deepEqual(calls[0], { baseUrl: 'https://fafaapi.info', timeoutMs: 45000 });
  await assert.rejects(() => saveEndpointConfig({ get: () => undefined }, { baseUrl: 'x' }), /不支持在插件页保存/u);
  await assert.rejects(
    () => saveEndpointConfig({ get: () => ({ entries: () => [], edit: async () => {} }) }, { baseUrl: 'x' }),
    /找不到本插件/u,
  );
});

test('settings routes: guard, endpoint persistence and input validation', async () => {
  const edits = [];
  const entry = { options: { id: 'dsh-fofatoto', name: 'dsh-fofatoto', config: {} } };
  const ctx = {
    get: (name) => {
      if (name === 'configEditor') {
        return { entries: () => [entry], edit: async (_target, change) => edits.push(change({}, {})) };
      }
      if (name === 'credentials') {
        return { resolve: async () => undefined, set: async () => {}, unset: async () => {} };
      }
      return undefined;
    },
  };
  let handler;
  const webServer = {
    register: (route) => {
      handler = route.handler;
      return () => {};
    },
  };
  registerRoutes(ctx, webServer, normalizeConfig({ baseUrl: 'https://fofa.info' }));
  assert.equal(typeof handler, 'function');

  /** Drive the route handler with a fake Node req/res pair. */
  const call = async (method, sub, body, headers = {}) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = `/plugins/dsh-fofatoto${sub}`;
    req.headers = headers;
    const chunks = [];
    const res = {
      writeHead: (status) => {
        res.status = status;
      },
      end: (chunk) => {
        chunks.push(chunk ?? '');
      },
    };
    const done = handler(req, res);
    if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
    await done;
    return { status: res.status, body: chunks.length === 0 ? undefined : JSON.parse(chunks.join('')) };
  };

  const guard = { 'x-dsh-fofatoto-plugin': '1' };
  assert.equal((await call('GET', '/settings')).status, 403);

  const status = await call('GET', '/settings', undefined, guard);
  assert.equal(status.status, 200);
  assert.equal(status.body.baseUrl, 'https://fofa.info');
  assert.equal(status.body.editable, true);
  assert.equal(Object.hasOwn(status.body, 'accountSource'), false);

  const saved = await call('POST', '/settings', { baseUrl: 'https://fafaapi.info' }, guard);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.ok, true);
  assert.equal(saved.body.saved, true);
  assert.equal(saved.body.reconfigApplied, true);
  assert.equal(saved.body.baseUrl, 'https://fafaapi.info');
  assert.equal(edits.length, 1);
  assert.equal(edits[0].baseUrl, 'https://fafaapi.info');

  const invalid = await call('POST', '/settings', { baseUrl: 'ftp://bad' }, guard);
  assert.equal(invalid.status, 200);
  assert.equal(invalid.body.ok, false);
  assert.match(invalid.body.error, /接口地址不合法/u);

  const badTest = await call('POST', '/test', { baseUrl: 'not-a-url' }, guard);
  assert.equal(badTest.status, 200);
  assert.equal(badTest.body.ok, false);
  assert.match(badTest.body.msg, /接口地址不合法/u);

  const noKey = await call('POST', '/test', {}, guard);
  assert.equal(noKey.status, 200);
  assert.equal(noKey.body.ok, false);
  assert.match(noKey.body.msg, /尚未配置/u);
});

/* ---------------------------------------------------------------- */
/* Config                                                            */
/* ---------------------------------------------------------------- */

test('config normalization clamps and defaults', () => {
  const config = normalizeConfig({ baseUrl: 'https://relay.example.com/', timeoutMs: 1, retries: 99, maxExportRows: 9999999 });
  assert.equal(config.baseUrl, 'https://relay.example.com');
  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.retries, 4);
  assert.equal(config.maxExportRows, 200000);
  assert.equal(normalizeConfig({ baseUrl: 'ftp://x' }).baseUrl, 'https://fofa.info');
  assert.equal(normalizeConfig({}).defaultFields, DEFAULT_FIELDS);
  assert.equal(normalizeConfig({}).maxExportSeconds, 240);
  assert.equal(normalizeConfig({ maxExportSeconds: 1 }).maxExportSeconds, 5);
  assert.equal(normalizeConfig({ maxExportSeconds: 9999 }).maxExportSeconds, 540);
});

/* ---------------------------------------------------------------- */
/* Live API (opt-in; consumes quota)                                 */
/* ---------------------------------------------------------------- */

const liveKey = process.env.FOFA_TEST_KEY ?? '';
const liveBase = process.env.FOFA_TEST_BASE ?? 'https://fafaapi.info';

test('live: account info', { skip: liveKey === '' }, async () => {
  const config = normalizeConfig({ baseUrl: liveBase, timeoutMs: 45000, retries: 2 });
  const { account } = await fetchAccount({ config, key: liveKey, signal: undefined });
  assert.ok(account.type === 'relay' || account.type === 'standard');
  assert.equal(typeof account.valid, 'boolean');
  console.log('live account:', JSON.stringify(account));
});

test('live: one search page', { skip: liveKey === '' }, async () => {
  const config = normalizeConfig({ baseUrl: liveBase, timeoutMs: 45000, retries: 2 });
  const result = await searchPage({
    config,
    key: liveKey,
    query: 'domain="example.com"',
    size: 1,
    page: 1,
    fields: 'host,ip,port',
    full: false,
    signal: undefined,
  });
  assert.equal(typeof result.total, 'number');
  assert.ok(Array.isArray(result.rows));
  console.log('live search:', JSON.stringify({ total: result.total, rows: result.rows }));
});

test('live: incremental export writes rows, meta and a cursor', { skip: liveKey === '' }, async () => {
  const config = normalizeConfig({ baseUrl: liveBase, timeoutMs: 45000, retries: 2, rateLimitSeconds: 0 });
  await withTempDir(async (dir) => {
    const path = join(dir, 'live.csv');
    const columns = ['url', 'host', 'ip', 'title'];
    const sink = await openSink({ path, format: 'csv', columns, mode: 'url' });
    const summary = await fetchInto({
      config,
      key: liveKey,
      query: 'domain="example.com"',
      limit: 3,
      fill: 1,
      columns,
      sink,
      full: false,
      signal: undefined,
      budgetSignal: undefined,
      startBefore: '',
      knownTotal: 0,
    });
    await sink.close();
    await writeExportMeta(path, {
      format: 'csv',
      query: 'domain="example.com"',
      columns,
      mode: 'url',
      total: summary.total,
      written: sink.count,
      nextBefore: summary.nextBefore,
      partial: summary.partial,
      stoppedReason: summary.stoppedReason,
    });
    assert.ok(summary.apiCalls >= 1);
    assert.ok(summary.total > 0);
    assert.ok(sink.count > 0);
    const text = await readFile(path, 'utf8');
    assert.equal(text.charCodeAt(0), 0xfeff);
    assert.equal(text.includes('url,host,ip,title'), true);
    const meta = await readExportMeta(path);
    assert.equal(meta.total, summary.total);
    console.log('live export:', JSON.stringify({ total: summary.total, rows: sink.count, stop: summary.stoppedReason, nextBefore: summary.nextBefore }));
  });
});
