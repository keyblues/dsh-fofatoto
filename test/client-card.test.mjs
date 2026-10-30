/**
 * Client-half smoke tests for the conversation cards.
 *
 * The bundle is a browser module (`window.__ModuleLoader__.load` + `require('react')`),
 * so this test fakes the loader and React just far enough to run `apply()` and
 * render each card variant. It never asserts pixels: it proves the cards run
 * without throwing, register in the right keyed slots, and show localized copy.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Minimal stateful React shim: elements are plain objects, hooks keep state
 * across re-renders, and `begin()` resets the hook cursor before one render.
 */
function makeReact() {
  let cells = [];
  let cursor = 0;
  const createElement = (type, props, ...children) => ({
    type,
    props: {
      ...(props ?? {}),
      children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children,
    },
  });
  return {
    begin() {
      cursor = 0;
    },
    reset() {
      cells = [];
      cursor = 0;
    },
    createElement,
    useState(initial) {
      const index = cursor;
      cursor += 1;
      if (cells[index] === undefined) cells[index] = initial;
      return [
        cells[index],
        (next) => {
          cells[index] = typeof next === 'function' ? next(cells[index]) : next;
        },
      ];
    },
    useMemo: (factory) => factory(),
    useCallback: (callback) => callback,
    useRef: (value) => ({ current: value }),
    useEffect: () => {},
  };
}

/** Every string inside one rendered element tree. */
function textsOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textsOf);
  if (typeof node === 'object') return textsOf(node.props?.children);
  return [];
}

/** Render one card collapsed; `toggle()` clicks the head and re-renders expanded. */
function mount(react, card, props) {
  react.reset();
  react.begin();
  const tree = card(props);
  return {
    collapsed: tree,
    toggle() {
      const head = tree.props.children[0];
      head.props.onClick();
      react.begin();
      return card(props);
    },
  };
}

/** Load the browser bundle under a faked loader and run its `apply()`. */
async function loadClient() {
  const react = makeReact();
  const registrations = [];
  let definition;

  globalThis.window = { __ModuleLoader__: { load: (loaded) => { definition = loaded; } } };
  globalThis.document = {
    documentElement: { lang: 'zh' },
    head: { appendChild: () => {} },
    createElement: () => ({ dataset: {}, remove: () => {} }),
    querySelector: () => null,
  };

  await import(`../client.js?t=${Date.now()}`);
  assert.ok(definition, 'client.js must call window.__ModuleLoader__.load');
  assert.equal(definition.id, 'dsh-fofatoto');

  const app = definition.factory((name) => {
    if (name === 'react') return react;
    throw new Error(`unexpected require: ${name}`);
  });
  assert.deepEqual(app.inject, ['slots', 'locale']);

  const dictionaries = [];
  const ctx = {
    effect: (body) => {
      body();
      return () => {};
    },
    locale: {
      bind: () => (key) => key,
      register: (namespace, dict) => {
        dictionaries.push({ namespace, dict });
        return () => {};
      },
    },
    slots: {
      inject: (_name, callback) => callback(),
      register: (options, component) => {
        registrations.push({ options, component });
        return () => {};
      },
    },
  };
  app.apply(ctx);
  return { registrations, dictionaries, react };
}

test('client half registers the settings card and one tool card per wire tool', async () => {
  const { registrations, dictionaries } = await loadClient();
  const bySlot = (name) => registrations.filter((entry) => entry.options.name === name);
  assert.equal(bySlot('plugins.bundle.config').length, 1);
  assert.equal(bySlot('plugins.bundle.config')[0].options.key, 'dsh-fofatoto');

  const toolviews = bySlot('tool.call.toolview');
  assert.deepEqual(
    toolviews.map((entry) => entry.options.key),
    ['fofa_account', 'fofa_search', 'fofa_export'],
  );
  for (const entry of toolviews) {
    assert.equal(typeof entry.component, 'function');
    assert.equal(entry.options.locale, 'dsh-fofatoto');
  }
  assert.equal(dictionaries[0].namespace, 'dsh-fofatoto');
  assert.equal(dictionaries[0].dict.zh['tool.search'], 'FOFA 检索');
});

test('tool cards are collapsed by default and summarize the call in the head', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;

  // Pending search call: collapsed head shows the query, body keeps the config.
  const pendingMount = mount(react, card, {
    toolName: 'fofa_search',
    phase: 'start',
    t,
    block: { phase: 'start', argsRaw: '{"query":"domain=\\"a.com\\"","size":2,"fields":"host,ip"}' },
  });
  assert.equal(pendingMount.collapsed.props.className, 'fft_tool');
  assert.equal(pendingMount.collapsed.props['data-state'], 'muted');
  assert.equal(pendingMount.collapsed.props.children[1], null, 'body is collapsed by default');
  const pendingHead = textsOf(pendingMount.collapsed).join('|');
  assert.match(pendingHead, /FOFA 检索/u);
  assert.match(pendingHead, /domain="a\.com"/u);
  const pendingBody = textsOf(pendingMount.toggle()).join('|');
  assert.match(pendingBody, /条数/u);
  assert.match(pendingBody, /字段/u);

  // Settled search: collapsed head = hit count + query; expanded = config + table.
  const settledMount = mount(react, card, {
    toolName: 'fofa_search',
    phase: 'result',
    t,
    block: {
      kind: 'result',
      isError: false,
      call: { name: 'fofa_search', argsRaw: '{"query":"domain=\\"a.com\\""}' },
      content: [
        {
          type: 'text',
          text: '命中 2 条 · 本页 1 条 · 去重 IP 1\n{"query":"domain=\\"a.com\\"","total":2,"page":1,"size":1,"fields":"host,ip","uniqueIps":1,"rows":[{"host":"a.a.com","ip":"1.2.3.4","port":"443","title":"A"}]}',
        },
      ],
    },
  });
  assert.equal(settledMount.collapsed.props['data-state'], 'ok');
  assert.equal(settledMount.collapsed.props.children[1], null, 'body is collapsed by default');
  const settledHead = textsOf(settledMount.collapsed).join('|');
  assert.match(settledHead, /命中 2 条/u);
  assert.match(settledHead, /domain="a\.com"/u);
  const settledText = textsOf(settledMount.toggle()).join('|');
  assert.match(settledText, /a\.a\.com/u);
  assert.match(settledText, /1\.2\.3\.4/u);
  assert.match(settledText, /语句/u);
  assert.match(settledText, /条数/u);
  assert.match(settledText, /页码/u);
  assert.match(settledText, /字段/u);
  assert.match(settledText, /host,ip/u);

  // Settled export: collapsed head = state + rows + query; expanded = full config.
  const exportMount = mount(react, card, {
    toolName: 'fofa_export',
    phase: 'result',
    t,
    block: {
      kind: 'result',
      isError: false,
      call: {
        name: 'fofa_export',
        argsRaw: '{"query":"domain=\\"a.com\\"","limit":1000,"fields":"host,ip","dedup":"url","format":"csv"}',
      },
      content: [
        {
          type: 'text',
          text: '导出完成 · csv · 2 行 → C:\\work\\out.csv\n{"path":"C:\\\\work\\\\out.csv","format":"csv","query":"domain=\\"a.com\\"","total":2,"written":2,"newRows":2,"rowsFetched":2,"apiCalls":2,"batches":1,"partial":false,"stoppedReason":"exhausted","nextBefore":null,"durationMs":1200,"resumed":false,"dedup":"url","fields":"host,ip","budgetSeconds":240}',
        },
      ],
    },
  });
  assert.equal(exportMount.collapsed.props.children[1], null, 'body is collapsed by default');
  const exportHead = textsOf(exportMount.collapsed).join('|');
  assert.match(exportHead, /csv/u);
  assert.match(exportHead, /2 行/u);
  assert.match(exportHead, /domain="a\.com"/u);
  const exportText = textsOf(exportMount.toggle()).join('|');
  assert.match(exportText, /C:\\work\\out\.csv/u);
  assert.match(exportText, /已取完/u);
  assert.match(exportText, /语句/u);
  assert.match(exportText, /domain="a\.com"/u);
  assert.match(exportText, /条数上限/u);
  assert.match(exportText, /1000/u);
  assert.match(exportText, /字段/u);
  assert.match(exportText, /host,ip/u);
  assert.match(exportText, /去重字段/u);
  assert.match(exportText, /url/u);

  // Spilled result: content is a disk locator, so the card facts come from the
  // durable `result.meta` written by `output.presentationMeta`.
  const spilledMount = mount(react, card, {
    toolName: 'fofa_search',
    phase: 'result',
    t,
    block: {
      kind: 'result',
      isError: false,
      call: { name: 'fofa_search', argsRaw: '{"query":"domain=\\"baidu.com\\"","size":1000}' },
      meta: {
        kind: 'search',
        query: 'domain="baidu.com"',
        total: 78717,
        page: 1,
        size: 1000,
        fields: 'host,ip,port,title',
        uniqueIps: 456,
        rowCount: 1000,
        rows: [{ host: 'a.baidu.com', ip: '1.2.3.4', port: '443', title: 'Baidu' }],
      },
      content: [{ type: 'text', text: '(Omitted 86719 bytes. Full formatted result stored at: C:\\Temp\\spill\\x.txt)' }],
    },
  });
  assert.equal(spilledMount.collapsed.props['data-state'], 'ok');
  const spilledHead = textsOf(spilledMount.collapsed).join('|');
  assert.match(spilledHead, /命中 78717 条/u);
  assert.match(spilledHead, /domain="baidu\.com"/u);
  const spilledText = textsOf(spilledMount.toggle()).join('|');
  assert.match(spilledText, /条数/u);
  assert.match(spilledText, /1000/u);
  assert.match(spilledText, /a\.baidu\.com/u);
  assert.match(spilledText, /落盘/u);

  // Failed call: the head already carries the error, no body needed.
  const failedMount = mount(react, card, {
    toolName: 'fofa_account',
    phase: 'result',
    t,
    block: { kind: 'result', isError: true, content: [{ type: 'text', text: 'Error: 尚未配置 FOFA API Key。' }] },
  });
  assert.equal(failedMount.collapsed.props['data-state'], 'error');
  assert.match(textsOf(failedMount.collapsed).join('|'), /尚未配置 FOFA API Key/u);

  // Legacy session log: the pre-fix render was bare compact JSON.
  const legacyMount = mount(react, card, {
    toolName: 'fofa_account',
    phase: 'result',
    t,
    block: {
      kind: 'result',
      isError: false,
      call: { name: 'fofa_account', argsRaw: '{}' },
      content: [
        {
          type: 'text',
          text: '{"httpStatus":200,"source":"credential","account":{"type":"relay","valid":true,"vip":false,"todayRemaining":91,"remainApiQuery":"不限","expiration":"2026-12-01","firstUsed":"","vipLevel":null,"server":null,"baseUrl":"https://fafaapi.info"}}',
        },
      ],
    },
  });
  assert.match(textsOf(legacyMount.collapsed).join('|'), /中转站/u);
  const legacyText = textsOf(legacyMount.toggle()).join('|');
  assert.match(legacyText, /91/u);
});
