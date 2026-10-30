/**
 * dsh-fofatoto — FOFA cyberspace mapping for DeepSeek Harness (Host half).
 *
 * Three model-facing tools over the FOFA HTTP API:
 *   - `fofa_account` — account type, key validity, remaining quota, expiry
 *   - `fofa_search`  — one query page, structured rows plus match total
 *   - `fofa_export`  — deep fetch (cursor pagination for >10000 rows) into CSV/JSON/TXT
 *
 * Plus three same-origin JSON routes consumed by this bundle's Client half
 * (client.js), which the Plugins page renders inside this bundle's detail page:
 *   GET  {prefix}/settings   -> current key status (never the key itself)
 *   POST {prefix}/settings   -> save / clear the API key
 *   POST {prefix}/test       -> one live account probe (also returns quota)
 *
 * The query semantics are ported from fofatoto v1.9.0 (same author,
 * GPL-3.0): qbase64 encoding, custom `url` field synthesis, `before="time"`
 * cursor pagination for deep exports, per-host deduplication and relay account
 * detection. The local Web UI, CLI, update checker, web_auth gates and the
 * favicon/icon_hash pivoting of the Python tool are intentionally not ported —
 * DSH already exposes shell and file tools, so icon pivoting stays in
 * fofatoto (`fofatoto --icon <url>`, or its `favicon_hash()`), and its
 * `icon_hash="..."` result feeds straight into `fofa_search`.
 *
 * API key resolution order: config.apiKey -> Harness credentials
 * (config.credentialRef, default FOFA_API_KEY) -> environment variable
 * (config.apiKeyEnv, default FOFA_KEY) -> optional local fofatoto
 * `config.json` (config.fofatotoConfigPath).
 */

import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { basename, extname, isAbsolute, join, resolve as resolvePath } from 'node:path';

const TAG = '[dsh-fofatoto]';
const DEFAULT_BASE_URL = 'https://fofa.info';
const DEFAULT_CREDENTIAL_REF = 'FOFA_API_KEY';
const DEFAULT_API_KEY_ENV = 'FOFA_KEY';
const DEFAULT_TIMEOUT_MS = 45000;
const MIN_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 180000;
const DEFAULT_RETRIES = 2;
const MIN_RETRIES = 1;
const MAX_RETRIES = 4;
const ROUTE_PREFIX = '/plugins/dsh-fofatoto';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SEARCH_SIZE = 10000;
const MAX_EXPORT_ROWS_CAP = 200000;
const USER_AGENT = 'dsh-fofatoto/0.1';
const DEFAULT_FIELD_LIST = ['host', 'ip', 'port', 'protocol', 'domain', 'title'];
const DEFAULT_FIELDS = DEFAULT_FIELD_LIST.join(',');

/**
 * Field universe of the FOFA result model (order = default export column order).
 * Kept in sync with fofatoto's `FofaResult`; `url` is tool-local and is never
 * sent to the API (it would answer HTTP 400).
 */
const ALL_FIELD_NAMES = [
  'host', 'ip', 'port', 'protocol', 'domain', 'title', 'server', 'country', 'city',
  'lastupdatetime', 'asn', 'org', 'os', 'icp', 'jarm', 'header', 'banner', 'cert',
  'product', 'product_category', 'version', 'cname', 'latitude', 'longitude',
  'region', 'country_name', 'base_protocol', 'link',
];
const CUSTOM_FIELDS = ['url'];

/**
 * Known FOFA relay stations and their custom account-info endpoint templates.
 * Ported from fofatoto's `RELAY_INFO_APIS` (domain suffix match, first hit
 * wins); a base URL with no matching domain falls back to the official
 * `/api/v1/info/my`. Adding a relay is a code change here, like fofatoto.
 * Placeholders: `{base}`/`{base_url}` = API root, `{key}` = URL-encoded key.
 */
const RELAY_INFO_APIS = {
  'fafaapi.info': '{base_url}/fofaapi/v1/validate-key?key={key}',
};

/** Thrown for upstream/HTTP failures; carries machine-readable detail. */
class FofaApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'FofaApiError';
    this.httpStatus = typeof options.httpStatus === 'number' ? options.httpStatus : 0;
    this.apiCode = Number.isFinite(Number(options.apiCode)) ? Number(options.apiCode) : null;
    this.fofaError = typeof options.fofaError === 'string' ? options.fofaError : '';
  }
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Read a non-empty trimmed string, else the fallback. */
function text(value, fallback) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

/** Clamp a config number into `[min, max]`, falling back on non-numbers. */
function clampNumber(value, fallback, min, max) {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Split a comma-separated field list, dropping blanks. */
function fieldList(fields) {
  if (typeof fields !== 'string') return [];
  return fields.split(',').map((field) => field.trim()).filter((field) => field !== '');
}

/** Append the required fields that `fields` is still missing. */
function appendMissingFields(fields, required) {
  const present = new Set(fieldList(fields));
  const missing = required.filter((field) => !present.has(field));
  if (missing.length === 0) return fields;
  return `${fields === '' ? '' : `${fields},`}${missing.join(',')}`;
}

/**
 * Map the user's requested fields onto the fields the API accepts: the local
 * `url` column is stripped and the columns needed to rebuild it are ensured.
 */
function apiFieldsFor(fields) {
  const requested = fieldList(fields);
  if (!requested.includes('url')) return fields;
  const withoutUrl = requested.filter((field) => field !== 'url').join(',');
  return appendMissingFields(withoutUrl, ['host', 'ip', 'port', 'protocol']);
}

/** One line-safe cell value for text rendering. */

/** Interruptible sleep; rejects with the abort reason. */
function sleep(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error('已取消'));
    };
    if (signal !== undefined) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(signal.reason instanceof Error ? signal.reason : new Error('已取消'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Config and credential resolution                                    */
/* ------------------------------------------------------------------ */

/** Normalize one API base URL (`''` when invalid and no fallback applies). */
function normalizeBaseUrl(value, fallback) {
  const raw = text(value, fallback).replace(/\/+$/u, '');
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return raw;
  } catch {
    // Fall through to the fallback.
  }
  return fallback;
}

/** Normalize the plugin's raw Cordis config into resolved values. */
function normalizeConfig(raw) {
  const config = raw !== null && typeof raw === 'object' ? raw : {};
  return {
    apiKey: typeof config.apiKey === 'string' ? config.apiKey.trim() : '',
    credentialRef: text(config.credentialRef, DEFAULT_CREDENTIAL_REF),
    apiKeyEnv: text(config.apiKeyEnv, DEFAULT_API_KEY_ENV),
    baseUrl: normalizeBaseUrl(config.baseUrl, DEFAULT_BASE_URL),
    timeoutMs: clampNumber(config.timeoutMs, DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS),
    retries: clampNumber(config.retries, DEFAULT_RETRIES, MIN_RETRIES, MAX_RETRIES),
    defaultFields: text(config.defaultFields, DEFAULT_FIELDS),
    outputDir: typeof config.outputDir === 'string' ? config.outputDir.trim() : '',
    maxExportRows: clampNumber(config.maxExportRows, 50000, 1, MAX_EXPORT_ROWS_CAP),
    maxExportSeconds: clampNumber(config.maxExportSeconds, 240, 5, 540),
    rateLimitSeconds: clampNumber(config.rateLimitSeconds, 5, 0, 60),
    fofatotoConfigPath: typeof config.fofatotoConfigPath === 'string' ? config.fofatotoConfigPath.trim() : '',
  };
}

/** Last four characters only — a hint that never reconstructs the key. */
function maskKey(key) {
  const value = typeof key === 'string' ? key.trim() : '';
  if (value === '') return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

/** Read `{ key, url }` from an optional local fofatoto config.json. */
async function readFofatotoConfig(config) {
  if (config.fofatotoConfigPath === '') return { key: '', url: '' };
  try {
    const parsed = JSON.parse(await readFile(config.fofatotoConfigPath, 'utf8'));
    return {
      key: typeof parsed?.key === 'string' ? parsed.key.trim() : '',
      url: typeof parsed?.url === 'string' ? parsed.url.trim() : '',
    };
  } catch {
    return { key: '', url: '' };
  }
}

/** Resolve the key from the credential store, the environment or fofatoto config. */
async function readStoredKey(ctx, config) {
  const credentials = ctx.get('credentials');
  if (credentials !== void 0 && typeof credentials.resolve === 'function') {
    try {
      const resolved = await credentials.resolve(config.credentialRef);
      const value = typeof resolved === 'string' ? resolved : resolved?.value;
      if (typeof value === 'string' && value.trim() !== '') {
        return { key: value.trim(), source: 'credential' };
      }
    } catch {
      // Fall through to the environment.
    }
  }
  const fromEnvironment = typeof process.env[config.apiKeyEnv] === 'string' ? process.env[config.apiKeyEnv].trim() : '';
  if (fromEnvironment !== '') return { key: fromEnvironment, source: 'env' };
  const local = await readFofatotoConfig(config);
  if (local.key !== '') return { key: local.key, source: 'file' };
  return { key: '', source: 'none' };
}

/** Resolve one call's key: literal config first, then the stored chain. */
async function resolveApiKey(ctx, config) {
  if (config.apiKey !== '') return { key: config.apiKey, source: 'config' };
  return await readStoredKey(ctx, config);
}

/** Settings-card status; never returns the key itself. */
function buildStatus(config, resolved, editable) {
  return {
    ok: true,
    configured: resolved.key !== '',
    source: resolved.source,
    hint: maskKey(resolved.key),
    baseUrl: config.baseUrl,
    credentialRef: config.credentialRef,
    editable,
  };
}

/** Read the current status for the settings card. */
async function keyStatus(ctx, config) {
  const resolved = await resolveApiKey(ctx, config);
  return buildStatus(config, resolved, canEditConfig(ctx));
}

/**
 * Persist baseUrl through the Host config editor, which writes the profile
 * patch and reconciles the Loader so the change is live.
 */
async function saveEndpointConfig(ctx, changes) {
  const editor = ctx.get('configEditor');
  if (editor === undefined || typeof editor.edit !== 'function') {
    throw new Error('当前环境不支持在插件页保存接口地址：请修改本 profile 的 cordis.patch.yml 中 dsh-fofatoto 行的 baseUrl。');
  }
  const entries = typeof editor.entries === 'function' ? editor.entries() : [];
  const entry = entries.find((candidate) => candidate?.options?.id === 'dsh-fofatoto');
  if (entry === undefined) {
    throw new Error('找不到本插件在 profile 中的配置行（id: dsh-fofatoto），无法保存接口地址；请改用 cordis.patch.yml。');
  }
  await editor.edit(entry, (current) => {
    const next = { ...(current ?? {}) };
    for (const [key, value] of Object.entries(changes)) {
      // An empty template means "back to auto-detect": drop the override.
      if (typeof value === 'string' && value === '') delete next[key];
      else next[key] = value;
    }
    return next;
  });
}

const MISSING_KEY_MESSAGE = [
  '尚未配置 FOFA API Key。',
  '配置方式（任选其一）：',
  '1) 在 DSH「插件」页打开 dsh-fofatoto，在配置卡片中粘贴 API Key 并保存（推荐，写入本机 Harness 凭据库）；',
  '2) 设置环境变量 FOFA_KEY 后重启 Harness；',
  '3) 在本 profile 的 cordis.patch.yml 中为 dsh-fofatoto 行设置 config.apiKey；',
  '4) 在插件配置里把 fofatotoConfigPath 指向本机 fofatoto 的 config.json，复用其中的 key。',
].join('\n');

/* ------------------------------------------------------------------ */
/* FOFA HTTP API                                                       */
/* ------------------------------------------------------------------ */

/** One bounded JSON GET against the configured FOFA base URL. */
async function fetchJson(url, { timeoutMs, signal, what }) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`${what}请求超时（${timeoutMs}ms）`));
  }, timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal !== undefined) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload;
    try {
      payload = raw === '' ? undefined : JSON.parse(raw);
    } catch {
      payload = undefined;
    }
    if (!response.ok) {
      const message =
        payload !== undefined && typeof payload === 'object' && typeof payload.errmsg === 'string' && payload.errmsg !== ''
          ? payload.errmsg
          : `HTTP ${response.status}`;
      throw new FofaApiError(`${what} HTTP ${response.status}`, { httpStatus: response.status, fofaError: message });
    }
    if (payload === undefined || payload === null || typeof payload !== 'object') {
      throw new FofaApiError(`${what}返回了无法解析的响应（非 JSON）`, { httpStatus: response.status });
    }
    return { payload, httpStatus: response.status };
  } catch (error) {
    if (error instanceof FofaApiError) throw error;
    const reason = controller.signal.aborted ? controller.signal.reason : error;
    throw new FofaApiError(`${what}请求失败：${reason instanceof Error ? reason.message : String(reason)}`);
  } finally {
    clearTimeout(timer);
    if (signal !== undefined) signal.removeEventListener('abort', onAbort);
  }
}

/** Whether an upstream error message is worth retrying (ported heuristic). */
function isRetryableApiError(message) {
  const lowered = String(message).toLowerCase();
  return ['[-501]', '[-702]', '服务错误', '稍候重试', '过于频繁', '频率', 'too many', '时间间隔', '429', 'timeout', 'timed out', 'temporar', 'try again'].some(
    (marker) => lowered.includes(marker),
  );
}

/** Backoff seconds for one failed attempt (ported; relay asks for ~5s). */
function retrySleepSeconds(error, attempt) {
  const raw = error instanceof Error ? error.message : String(error);
  const text = error instanceof FofaApiError && error.fofaError !== '' ? `${raw} ${error.fofaError}` : raw;
  // The relay says exactly how long to wait ("请5秒后再试"); honor it.
  const hint = /(\d+)\s*秒/u.exec(text);
  if (hint !== null) return Math.min(30, Math.max(1, Number(hint[1]) + 1));
  return isRetryableApiError(text) ? Math.min(10 * attempt, 30) : Math.min(2 * attempt, 8);
}

/** Run one upstream operation with bounded, interruptible retries. */
async function withRetry(config, signal, operation) {
  let lastError = null;
  for (let attempt = 1; attempt <= config.retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      if (!_isRetryable(error) || attempt >= config.retries) break;
      await sleep(retrySleepSeconds(error, attempt) * 1000, signal);
    }
  }
  throw lastError ?? new FofaApiError('FOFA 请求失败');
}

/** Turn an upstream or transport failure into an actionable model-facing error. */
function explainApiError(error) {
  if (!(error instanceof FofaApiError)) {
    return error instanceof Error ? error.message : String(error);
  }
  const detail = `${error.message}${error.fofaError === '' ? '' : `：${error.fofaError}`}`;
  if (error.httpStatus === 429 || /过于频繁|频率|too many|429/iu.test(detail)) {
    return `${detail}\n请求被限流：FOFA 中转站对账户/检索接口有数秒级频率限制。稍等 5–10 秒再试；批量导出请把插件配置 rateLimitSeconds 调大。`;
  }
  if (/key|密钥|账号|账户|无效|未授权|unauthorized|auth/iu.test(detail)) {
    return `${detail}\nAPI Key 无效或未授权：请在 DSH「插件」页打开 dsh-fofatoto 粘贴新的 FOFA API Key，或检查中转站地址是否正确（配置 baseUrl）。`;
  }
  if (/额度|次数|限制|quota|余额|超出|exceed/iu.test(detail)) {
    return `${detail}\n当前账号额度不足：先用 fofa_account 查看剩余额度，再缩小 size/limit、合并查询语句或稍后重试。`;
  }
  if (/参数|语法|syntax|query|换行/iu.test(detail)) {
    return `${detail}\n查询语句或参数不合法：检查 FOFA 语法（如 domain="a.com" && port="443"），或去掉不支持的字段。`;
  }
  return detail;
}

/** Whether this Host can persist endpoint settings through the config editor. */
function canEditConfig(ctx) {
  const editor = ctx.get('configEditor');
  return editor !== undefined && typeof editor.edit === 'function';
}

/**
 * Detect the relay account-info endpoint for a base URL, mirroring fofatoto's
 * `_detect_relay_info_api`: known relay domains are matched by suffix and the
 * first hit wins; no hit means the official `/api/v1/info/my`. Adding a relay
 * is a code change to `RELAY_INFO_APIS`, exactly like fofatoto.
 * @returns {{kind:'relay'|'official', template:string, relayDomain?:string}}
 */
function detectAccountEndpoint(baseUrl) {
  let hostname = '';
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    hostname = '';
  }
  if (hostname !== '') {
    for (const [domain, template] of Object.entries(RELAY_INFO_APIS)) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return { kind: 'relay', template, relayDomain: domain };
      }
    }
  }
  return { kind: 'official', template: '{base_url}/api/v1/info/my?key={key}' };
}

/** Render an endpoint template for display (key placeholder kept). */
function renderEndpointTemplate(target, baseUrl) {
  return String(target.template).replaceAll('{base_url}', baseUrl).replaceAll('{base}', baseUrl);
}

/** Expand an endpoint template into a request URL with the real key. */
function expandAccountEndpoint(target, config, key) {
  const template = renderEndpointTemplate(target, config.baseUrl);
  const hasPlaceholder = template.includes('{key}');
  const filled = hasPlaceholder ? template.replaceAll('{key}', encodeURIComponent(key)) : template;
  let url;
  try {
    url = new URL(filled);
  } catch {
    throw new FofaApiError(`账号信息接口模板不合法（需要完整 http(s) 地址）：${template}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FofaApiError('账号信息接口模板必须是 http(s) 地址');
  }
  // A template without `{key}` still gets the key as a query parameter.
  if (!hasPlaceholder) url.searchParams.set('key', key);
  return url.toString();
}

/** First present, non-null field from a list of aliases. */
function pickField(source, names) {
  for (const name of names) {
    if (Object.hasOwn(source, name)) {
      const value = source[name];
      if (value !== undefined && value !== null) return value;
    }
  }
  return null;
}

/**
 * Normalize an optional relay scalar to `number | string | boolean | null`.
 * Relays disagree on types, so the canonical value keeps the transport shape
 * instead of failing the tool's own output schema.
 */
function scalarOrNull(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  return null;
}

/** Normalize an optional text field to a string (`''` when absent or non-text). */
function textOrEmpty(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** Normalize one account payload from a relay or the official API. */
function normalizeAccountPayload(payload, target, baseUrl) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new FofaApiError('账号信息接口返回了无法解析的数据');
  }
  if (payload.error === true || payload.success === false) {
    throw new FofaApiError('账号信息接口返回失败', {
      apiCode: payload.errorCode ?? null,
      fofaError: String(payload.errmsg ?? payload.msg ?? '未知错误'),
    });
  }
  // Some relays wrap the body in `data`; read through it when present.
  const source =
    payload.data !== null && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? { ...payload, ...payload.data }
      : payload;
  const validRaw = pickField(source, ['valid', 'isvip', 'is_vip', 'vip']);
  return {
    type: target.kind === 'official' ? 'standard' : 'relay',
    valid: validRaw === null ? true : validRaw === true || validRaw === 1 || validRaw === 'true',
    vip: validRaw === true || validRaw === 1,
    todayRemaining: scalarOrNull(pickField(source, ['todayRemaining', 'today_remaining', 'todayRemain', 'today_left'])),
    remainApiQuery: scalarOrNull(pickField(source, ['totalRemaining', 'remain_api_query', 'remainApiQuery', 'remaining', 'left'])),
    expiration: textOrEmpty(pickField(source, ['expireTime', 'expiration', 'expire_time', 'expireAt'])),
    firstUsed: textOrEmpty(pickField(source, ['firstUsedAt', 'first_used', 'firstUsed'])),
    vipLevel: scalarOrNull(pickField(source, ['vip_level', 'vipLevel'])),
    server: scalarOrNull(pickField(source, ['fofa_server'])),
    baseUrl,
  };
}

/** Query account info from the configured endpoint, with retries. */
async function fetchAccount({ config, key, signal }) {
  const target = detectAccountEndpoint(config.baseUrl);
  const probe = async () => {
    const url = expandAccountEndpoint(target, config, key);
    const { payload, httpStatus } = await fetchJson(url, {
      timeoutMs: config.timeoutMs,
      signal,
      what: target.kind === 'official' ? 'FOFA 账户信息' : '账号信息接口',
    });
    return { httpStatus, account: normalizeAccountPayload(payload, target, config.baseUrl) };
  };
  return await withRetry(config, signal, probe);
}

/**
 * One FOFA search page with retries.
 * @returns {Promise<{ total:number, rows:object[], httpStatus:number, attempts:number }>}
 */
async function searchPage({ config, key, query, size, page, fields, full, signal }) {
  const apiFields = apiFieldsFor(fields);
  const apiFieldList = fieldList(apiFields);
  const qbase64 = Buffer.from(query, 'utf8').toString('base64');
  const url = new URL(`${config.baseUrl}/api/v1/search/all`);
  url.searchParams.set('key', key);
  url.searchParams.set('qbase64', qbase64);
  url.searchParams.set('size', String(size));
  url.searchParams.set('page', String(page));
  url.searchParams.set('fields', apiFields);
  if (full) url.searchParams.set('full', 'true');

  let lastError = null;
  for (let attempt = 1; attempt <= config.retries; attempt += 1) {
    try {
      const { payload, httpStatus } = await fetchJson(url.toString(), {
        timeoutMs: config.timeoutMs,
        signal,
        what: 'FOFA 搜索接口',
      });
      if (payload.error) {
        throw new FofaApiError('FOFA 搜索接口返回失败', {
          httpStatus,
          apiCode: payload.errorCode ?? null,
          fofaError: typeof payload.errmsg === 'string' ? payload.errmsg : '未知错误',
        });
      }
      const rows = parseRows(Array.isArray(payload.results) ? payload.results : [], apiFieldList, fieldList(fields));
      return {
        total: Number.isFinite(Number(payload.size)) ? Number(payload.size) : rows.length,
        rows,
        httpStatus,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      const retryable = _isRetryable(error);
      if (!retryable || attempt >= config.retries) break;
      await sleep(retrySleepSeconds(error, attempt) * 1000, signal);
    }
  }
  throw lastError ?? new FofaApiError('FOFA 搜索请求失败');
}

/** Retryable when the transport failed or the upstream message says so. */
function _isRetryable(error) {
  if (!(error instanceof FofaApiError)) return true;
  if (error.httpStatus === 0) return true;
  if (error.httpStatus >= 500) return true;
  return isRetryableApiError(`${error.message} ${error.fofaError}`);
}

/** Infer a usable domain from host; IP literals answer ''. */
function inferDomainFromHost(host) {
  const value = typeof host === 'string' ? host.trim() : '';
  if (value === '') return '';
  try {
    const parsed = new URL(value.startsWith('http') ? value : `http://${value}`);
    const hostname = parsed.hostname;
    if (hostname === '') return '';
    return isIP(hostname) === 0 ? hostname : '';
  } catch {
    return '';
  }
}

/** Build a full URL from the host/ip/port/protocol columns (ported). */
function buildUrl(row) {
  const host = typeof row.host === 'string' ? row.host : row.host === undefined || row.host === null ? '' : String(row.host);
  if (host === '') return '';
  if (host.startsWith('http')) return host;
  let hostHasPort = false;
  try {
    hostHasPort = new URL(`http://${host}`).port !== '';
  } catch {
    hostHasPort = false;
  }
  const port = row.port === undefined || row.port === null ? '' : String(row.port);
  const rawProtocol = row.protocol === undefined || row.protocol === null ? '' : String(row.protocol).toLowerCase();
  let protocol = rawProtocol;
  if (protocol === '') protocol = ['443', '8443', '4443'].includes(port) ? 'https' : 'http';
  if (protocol.includes(',')) protocol = protocol.split(',')[0].trim();
  if (!hostHasPort && port !== '') {
    if ((protocol === 'http' && port === '80') || (protocol === 'https' && port === '443')) {
      return `${protocol}://${host}`;
    }
    return `${protocol}://${host}:${port}`;
  }
  return `${protocol}://${host}`;
}

/** Turn raw FOFA rows into objects aligned with the requested fields. */
function parseRows(rawResults, apiFieldList, displayFields) {
  const wantDomain = displayFields.includes('domain');
  const wantUrl = displayFields.includes('url');
  const rows = [];
  for (const item of rawResults) {
    const values = Array.isArray(item) ? item : [item];
    const row = {};
    apiFieldList.forEach((field, index) => {
      const value = index < values.length ? values[index] : '';
      row[field] = value === null || value === undefined ? '' : value;
    });
    if (wantDomain && row.host !== '' && (row.domain === undefined || row.domain === '')) {
      row.domain = inferDomainFromHost(row.host);
    }
    if (wantUrl) row.url = buildUrl(row);
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Deep export                                                         */
/* ------------------------------------------------------------------ */

/** Parse `YYYY-MM-DD HH:MM:SS` as UTC; null when malformed. */
function parseFofaTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value);
  if (match === null) return null;
  const [, year, month, day, hour, minute, second] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

/** Format epoch milliseconds as FOFA's UTC `YYYY-MM-DD HH:MM:SS`. */
function formatFofaTime(epochMs) {
  return new Date(epochMs).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Fetch a query deeper than one page using the `before="time"` cursor.
 * Ported from fofatoto `search_all_efficient`: newest-first pages, one-second
 * cursor step, per-host deduplication and rate-limited batches.
 */
/** Raised when the export's own time budget expires (graceful stop, not an error). */
class ExportBudgetError extends Error {
  constructor() {
    super('导出时间预算已用尽');
    this.name = 'ExportBudgetError';
  }
}

/** Fuse several abort signals into one; undefined when there is nothing to fuse. */
function combineSignals(signals) {
  const list = signals.filter((signal) => signal !== undefined && signal !== null);
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(list);
  const controller = new AbortController();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

/** Deduplication key of one row under the given columns. */
function dedupKey(row, fields) {
  const parts = [];
  for (const field of fields) {
    if (field === 'url') {
      parts.push(buildUrl(row));
      continue;
    }
    const value = row[field];
    parts.push(value === null || value === undefined ? '' : typeof value === 'string' ? value : String(value));
  }
  return parts.join('\u0001');
}

/**
 * Fetch one query into an open sink, writing every batch before requesting the
 * next one. Fetched rows are therefore never held only in memory: a time-budget
 * expiry, an upstream failure or an abort keeps everything already written on
 * disk, and `nextBefore` carries the cursor so a follow-up call can continue
 * without re-spending quota on the rows already pulled.
 *
 * @returns {Promise<object>} run summary (row counts, stop reason, cursor).
 */
async function fetchInto(options) {
  const {
    config,
    key,
    query,
    limit,
    fill,
    columns,
    sink,
    searchImpl,
    full,
    signal,
    budgetSignal,
    startBefore,
    knownTotal,
    onPage,
  } = options;
  // Injectable for tests; production always uses the FOFA page search.
  const search = typeof searchImpl === 'function' ? searchImpl : searchPage;
  const apiFieldString = appendMissingFields(apiFieldsFor(columns.join(',')), ['lastupdatetime', 'host']);
  const seen = new Set();
  const summary = {
    total: knownTotal ?? 0,
    newRows: 0,
    rowsFetched: 0,
    apiCalls: 0,
    batches: 0,
    partial: false,
    stoppedReason: 'exhausted',
    nextBefore: null,
  };
  const budgetExpired = () => budgetSignal !== undefined && budgetSignal.aborted;
  const requestSignal = () => combineSignals([signal, budgetSignal]);

  let target;
  if (startBefore === '') {
    const countPage = await search({
      config,
      key,
      query,
      size: 1,
      page: 1,
      fields: apiFieldString,
      full,
      signal,
    });
    summary.apiCalls += 1;
    summary.total = countPage.total;
    if (summary.total === 0) {
      summary.stoppedReason = 'empty';
      return summary;
    }
    const effectiveFill = typeof fill === 'number' && fill > 0 && fill <= 1 ? fill : 1;
    target = Math.floor(summary.total * effectiveFill);
    if (target < 1) target = 1;
    if (limit > 0 && target > limit) target = limit;
  } else {
    // A resumed run only pulls the requested number of *new* rows.
    target = limit > 0 ? limit : config.maxExportRows;
  }
  if (target > config.maxExportRows) target = config.maxExportRows;

  let beforeTime = startBefore;
  const maxBatches = Math.ceil(config.maxExportRows / 10000) + 8;
  for (;;) {
    if (budgetExpired()) {
      summary.partial = true;
      summary.stoppedReason = 'time-budget';
      break;
    }
    if (summary.batches > maxBatches) {
      summary.stoppedReason = 'batch-cap';
      break;
    }
    const remaining = target - summary.newRows;
    if (remaining <= 0) {
      summary.stoppedReason = sink.count < summary.total ? 'limit' : 'complete';
      break;
    }
    const minTail = target > 10000 ? 1000 : 0;
    const requestSize = Math.min(10000, Math.max(remaining, minTail));
    const rangeQuery = beforeTime === '' ? query : `${query} && before="${beforeTime}"`;
    let page;
    try {
      page = await search({
        config,
        key,
        query: rangeQuery,
        size: requestSize,
        page: 1,
        fields: apiFieldString,
        full,
        signal: requestSignal(),
      });
    } catch (error) {
      if (budgetExpired() && signal?.aborted !== true) {
        summary.partial = true;
        summary.stoppedReason = 'time-budget';
        break;
      }
      if (signal?.aborted) throw error;
      if (sink.count > 0) {
        summary.partial = true;
        summary.stoppedReason = 'upstream-error';
        summary.error = error;
        break;
      }
      throw error;
    }
    summary.apiCalls += 1;
    summary.rowsFetched += page.rows.length;
    if (page.rows.length === 0) {
      summary.stoppedReason = 'exhausted';
      break;
    }
    const batch = [];
    let batchMinTime = '';
    for (const row of page.rows) {
      const keyText = dedupKey(row, columns);
      const updated = typeof row.lastupdatetime === 'string' ? row.lastupdatetime : '';
      if (updated !== '' && (batchMinTime === '' || updated < batchMinTime)) batchMinTime = updated;
      if (seen.has(keyText)) continue;
      seen.add(keyText);
      if (columns.includes('url')) row.url = buildUrl(row);
      batch.push(row);
    }
    // Advance the cursor even when every row in this page was a duplicate,
    // otherwise a page made only of duplicates would loop forever.
    const epoch = parseFofaTime(batchMinTime);
    summary.nextBefore = epoch === null ? null : formatFofaTime(epoch - 1000);
    if (batch.length > 0) {
      const written = await sink.writeRows(batch);
      summary.newRows += written;
      summary.batches += 1;
      if (typeof onPage === 'function') {
        onPage({ batches: summary.batches, written: sink.count, total: summary.total });
      }
    }
    if (page.rows.length < requestSize) {
      summary.nextBefore = null;
      summary.stoppedReason = sink.count < summary.total ? 'exhausted' : 'complete';
      break;
    }
    if (summary.nextBefore === null) break;
    beforeTime = summary.nextBefore;
    // Rate-limit between batches; the budget may expire during the wait.
    try {
      await sleep(config.rateLimitSeconds * 1000, requestSignal());
    } catch (error) {
      if (budgetExpired() && signal?.aborted !== true) {
        summary.partial = true;
        summary.stoppedReason = 'time-budget';
        break;
      }
      throw error;
    }
  }
  return summary;
}

/* ------------------------------------------------------------------ */
/* Export writers                                                      */
/* ------------------------------------------------------------------ */

/** One CSV cell, quoted only when needed. */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'string' ? value : String(value);
  return /[",\r\n]/u.test(raw) ? `"${raw.replace(/"/gu, '""')}"` : raw;
}

/** TXT export mode implied by the exported columns (ported from fofatoto). */
function txtMode(columns) {
  const set = new Set(columns);
  if (set.size === 1 && set.has('ip')) return 'ip';
  if (set.size === 1 && set.has('domain')) return 'domain';
  return 'url';
}

/** One TXT line for a row ('' when the row has nothing to print). */
function txtLine(row, mode) {
  if (mode === 'ip') return row.ip === undefined || row.ip === null ? '' : String(row.ip);
  if (mode === 'domain') return row.domain === undefined || row.domain === null ? '' : String(row.domain);
  const url = buildUrl(row);
  if (url !== '') return url;
  return row.ip === undefined || row.ip === null ? '' : String(row.ip);
}

/** Sidecar metadata path for an export file. */
function metaPathOf(path) {
  return `${path}.meta.json`;
}

/** Write the sidecar that makes an export resumable and self-describing. */
async function writeExportMeta(path, meta) {
  const payload = {
    plugin: 'dsh-fofatoto',
    version: 1,
    updatedAt: new Date().toISOString(),
    ...meta,
  };
  await writeFile(metaPathOf(path), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/** Read a sidecar; throws a model-facing error when it is missing or foreign. */
async function readExportMeta(path) {
  let raw;
  try {
    raw = await readFile(metaPathOf(path), 'utf8');
  } catch {
    throw new Error(`该文件不是可分片续拉的导出（缺少 ${metaPathOf(path)}）：请重新用 fofa_export 全量拉取，或改用 csv/txt。`);
  }
  let meta;
  try {
    meta = JSON.parse(raw);
  } catch {
    throw new Error('导出元数据损坏，无法续拉。');
  }
  if (meta === null || typeof meta !== 'object' || meta.plugin !== 'dsh-fofatoto') {
    throw new Error('该元数据不属于 dsh-fofatoto 导出，无法续拉。');
  }
  return meta;
}

/**
 * Open the incremental export sink. Every `writeRows` appends and fsyncs, so
 * rows survive a later timeout/abort/restart; `close` finalizes JSON with its
 * closing bracket and never leaves an invalid file behind.
 */
async function openSink({ path, format, columns, mode, append, initialCount = 0 }) {
  if (format === 'json' && append) {
    throw new Error('JSON 不支持断点续拉：请改用 csv 或 txt，或分片导出后合并。');
  }
  const handle = await open(path, append ? 'a' : 'w');
  let closed = false;
  const sink = {
    path,
    format,
    columns,
    mode,
    count: append ? initialCount : 0,
    startCount: append ? initialCount : 0,
    async writeRows(rows) {
      if (rows.length === 0) return 0;
      let chunk = '';
      let written = 0;
      if (format === 'csv') {
        chunk = `${rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\r\n')}\r\n`;
        written = rows.length;
      } else if (format === 'json') {
        const objects = rows.map((row) => {
          const item = {};
          for (const column of columns) {
            const value = row[column];
            item[column] = value === undefined || value === null ? '' : value;
          }
          return JSON.stringify(item);
        });
        chunk = `${sink.count === 0 ? '' : ',\n'}${objects.join(',\n')}`;
        written = rows.length;
      } else {
        const lines = [];
        for (const row of rows) {
          const line = txtLine(row, mode);
          if (line !== '') lines.push(line);
        }
        chunk = lines.length === 0 ? '' : `${lines.join('\n')}\n`;
        written = lines.length;
      }
      if (chunk !== '') {
        await handle.write(chunk);
        await handle.datasync();
      }
      sink.count += written;
      return written;
    },
    async close() {
      if (closed) return;
      closed = true;
      try {
        if (format === 'json') await handle.write(sink.count === 0 ? ']\n' : '\n]\n');
      } finally {
        await handle.close();
      }
    },
  };
  if (!append) {
    if (format === 'csv') await handle.write(`\uFEFF${columns.map(csvCell).join(',')}\r\n`);
    else if (format === 'json') await handle.write('[\n');
  }
  return sink;
}

async function uniquePath(path) {
  const extension = extname(path);
  const stem = path.slice(0, path.length - extension.length);
  let candidate = path;
  for (let index = 1; ; index += 1) {
    try {
      await stat(candidate);
    } catch {
      return candidate;
    }
    candidate = `${stem}_${index}${extension}`;
  }
}

/** Resolve the session's base directory for relative output paths. */
async function sessionBaseDirectory(ctx, exec) {
  const workingDirectory = ctx.get('workingDirectory');
  if (workingDirectory !== void 0 && exec?.agent !== undefined && typeof workingDirectory.ensure === 'function') {
    try {
      const directory = await workingDirectory.ensure(exec.agent);
      if (typeof directory === 'string' && directory !== '') return directory;
    } catch {
      // Fall through.
    }
  }
  if (workingDirectory !== void 0 && typeof workingDirectory.defaultDirectory === 'string' && workingDirectory.defaultDirectory !== '') {
    return workingDirectory.defaultDirectory;
  }
  return process.cwd();
}

/** Resolve the directory exported files are written to. */
async function resolveOutputDir(ctx, config, exec) {
  const base = await sessionBaseDirectory(ctx, exec);
  if (config.outputDir !== '') {
    return isAbsolute(config.outputDir) ? config.outputDir : resolvePath(base, config.outputDir);
  }
  return join(base, 'fofa-output');
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/**
 * Model-facing text of one tool value: compact JSON. The canonical value and
 * this body stay one-to-one with `output.schema`, so a program can parse it
 * without consulting the schema and the model reads the same shape PTC sees.
 */
function renderJson(value) {
  return JSON.stringify(value);
}

/** True for scalars that are safe to print in a summary line. */
function hasScalar(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * One readable summary line in front of the canonical JSON body.
 * The JSON stays complete and machine-parseable; the line only adds orientation.
 */
function renderWithSummary(summary, value) {
  const body = renderJson(value);
  return summary === '' ? body : `${summary}\n${body}`;
}

/** Chinese summary line for `fofa_account` (account type, validity, quota). */
function accountSummary(value) {
  const account =
    value !== null && typeof value === 'object' && value.account !== null && typeof value.account === 'object' ? value.account : {};
  const bits = [];
  if (account.type === 'relay') bits.push('中转站');
  else if (account.type === 'standard') bits.push('标准版');
  else if (hasScalar(account.type)) bits.push(String(account.type));
  bits.push(account.valid === true ? 'Key 有效' : 'Key 无效');
  if (hasScalar(account.todayRemaining)) bits.push(`今日剩余 ${account.todayRemaining}`);
  if (hasScalar(account.remainApiQuery)) bits.push(`剩余查询 ${account.remainApiQuery}`);
  if (typeof account.expiration === 'string' && account.expiration !== '') bits.push(`到期 ${account.expiration}`);
  return bits.join(' · ');
}

/** Chinese summary line for `fofa_search` (match total, page size, unique IPs). */
function searchSummary(value) {
  const total = Number.isInteger(value?.total) ? value.total : 0;
  const rows = Array.isArray(value?.rows) ? value.rows.length : 0;
  const bits = [`命中 ${total} 条`, `本页 ${rows} 条`];
  if (Number.isInteger(value?.page) && value.page > 1) bits.push(`第 ${value.page} 页`);
  if (Number.isInteger(value?.uniqueIps)) bits.push(`去重 IP ${value.uniqueIps}`);
  return bits.join(' · ');
}

/** Chinese summary line for `fofa_export` (state, format, rows, file, cursor hint). */
function exportSummary(value) {
  const partial = value?.partial === true;
  const reason = typeof value?.stoppedReason === 'string' && value.stoppedReason !== '' ? value.stoppedReason : '中止';
  const bits = [partial ? `导出未完成（${reason}）` : '导出完成'];
  if (typeof value?.format === 'string' && value.format !== '') bits.push(value.format);
  if (Number.isInteger(value?.written)) bits.push(`${value.written} 行`);
  if (Number.isInteger(value?.total) && value.total > (Number.isInteger(value?.written) ? value.written : 0)) {
    bits.push(`总匹配 ${value.total}`);
  }
  const path = typeof value?.path === 'string' ? value.path : '';
  if (path === '') return bits.join(' · ');
  const hint = partial && typeof value?.nextBefore === 'string' ? '（可 appendTo 续拉）' : '';
  return `${bits.join(' · ')} → ${path}${hint}`;
}

/** Render the account probe: readable line + canonical JSON. */
function renderAccount(value) {
  return renderWithSummary(accountSummary(value), value);
}

/** Render one search page: readable line + canonical JSON. */
function renderSearch(value) {
  return renderWithSummary(searchSummary(value), value);
}

/** Render one export result: readable line + canonical JSON. */
function renderExport(value) {
  return renderWithSummary(exportSummary(value), value);
}

/** A scalar-or-null contract shared by the account fields relays vary on. */
function scalarOrNullSchema(description) {
  return {
    description,
    oneOf: [{ type: 'number' }, { type: 'string' }, { type: 'boolean' }, { type: 'null' }],
  };
}

/** Columns the conversation card shows, mirrored into `presentationMeta`. */
const PRESENTATION_ROW_COLUMNS = ['host', 'ip', 'port', 'title'];

/**
 * Bounded row preview for `output.presentationMeta`. The card needs at most a
 * handful of short cells, so the persisted metadata stays small even when the
 * full model-facing content was spilled to disk.
 * @param {object[]} rows canonical rows
 * @returns {object[]} up to 8 rows with card columns only
 */
function presentationRows(rows) {
  return rows.slice(0, 8).map((row) => {
    const picked = {};
    if (row === null || typeof row !== 'object') return picked;
    for (const column of PRESENTATION_ROW_COLUMNS) {
      if (!Object.hasOwn(row, column)) continue;
      const value = row[column];
      picked[column] = typeof value === 'string' ? value.slice(0, 200) : value;
    }
    return picked;
  });
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

/** Common search column schema. */
const FIELDS_PARAM = {
  type: 'string',
  description:
    '逗号分隔字段，缺省 host,ip,port,protocol,domain,title。可选 host,ip,port,protocol,domain,title,server,country,city,lastupdatetime,asn,org,os,icp,jarm,header,banner,cert,product,product_category,version,cname,latitude,longitude,region,country_name,base_protocol,link，以及本地拼接的 url。',
};

/**
 * Documented row columns for `output.schema`. Each value is an annotation-only
 * node, so a relay that returns a number where the API normally returns a
 * string never invalidates an otherwise good canonical value.
 */
const ROW_FIELD_PROPERTIES = Object.fromEntries(
  [...ALL_FIELD_NAMES, ...CUSTOM_FIELDS].map((field) => [
    field,
    { description: field === 'url' ? '本地按 host/ip/port/protocol 拼接的完整 URL' : `FOFA 字段 ${field}` },
  ]),
);

/** Resolve the key or throw the actionable missing-key error. */
async function keyOrThrow(ctx, config) {
  const resolved = await resolveApiKey(ctx, config);
  if (resolved.key === '') throw new Error(MISSING_KEY_MESSAGE);
  return resolved;
}

/** Register the four model-facing tools. */
function registerTools(ctx, config) {
  const accountTool = {
    name: 'fofa_account',
    description:
      '查询 FOFA 账号状态：账户类型（官方/中转站）、Key 是否有效、剩余查询额度、今日剩余与到期时间。测绘动手前先调用本工具，避免把额度耗在无效查询上。不消耗查询额度。',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          httpStatus: { type: 'integer' },
          source: { type: 'string', enum: ['config', 'credential', 'env', 'file'] },
          account: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['standard', 'relay'] },
              valid: { type: 'boolean' },
              vip: { type: 'boolean' },
              todayRemaining: scalarOrNullSchema('今日剩余查询数（中转站可能是数字、字符串或 null）'),
              remainApiQuery: scalarOrNullSchema('剩余查询额度（官方为数字，部分中转站返回字符串）'),
              expiration: { type: 'string', description: '到期时间；未知时为空串' },
              firstUsed: { type: 'string', description: '首次使用时间；未知时为空串' },
              vipLevel: scalarOrNullSchema('VIP 等级；未知时为 null'),
              server: scalarOrNullSchema('fofa_server 标记；未知时为 null'),
              baseUrl: { type: 'string' },
            },
            required: [
              'type',
              'valid',
              'vip',
              'todayRemaining',
              'remainApiQuery',
              'expiration',
              'firstUsed',
              'vipLevel',
              'server',
              'baseUrl',
            ],
          },
        },
        required: ['httpStatus', 'source', 'account'],
      },
      render: (_args, value) => [{ type: 'text', text: renderAccount(value) }],
      presentationMeta: (_args, value) => ({
        kind: 'account',
        httpStatus: value.httpStatus,
        source: value.source,
        account: value.account,
      }),
    },
    timeoutMs: config.timeoutMs + 15000,
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      const resolved = await keyOrThrow(ctx, config);
      try {
        const { account, httpStatus } = await fetchAccount({ config, key: resolved.key, signal: exec.signal });
        return { httpStatus, source: resolved.source, account };
      } catch (error) {
        throw new Error(explainApiError(error));
      }
    },
  };

  const searchTool = {
    name: 'fofa_search',
    description:
      '执行一条 FOFA 查询语句，返回匹配总数与本页结构化结果（每次调用消耗 1 次查询额度）。适合先看总量再决定是否全量导出；单页最多 1 万条，但超过数百条建议改用 fofa_export 落盘。结果过大时 Harness 会把本页内容落盘（spill）并在结果里给出路径，取数请用 fofa_export。语句示例：domain="example.com"、ip="1.2.3.0/24"、title="管理后台"、cert="example.com"。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'FOFA 查询语句，例如 domain="example.com" && port="443"' },
        size: { type: 'integer', description: '本次返回条数，1-10000，默认 50。建议先用小值看总量；大页结果会被 spill，取数请用 fofa_export。' },
        page: { type: 'integer', description: '页码，默认 1。深翻页不稳定，全量请用 fofa_export。' },
        fields: FIELDS_PARAM,
        full: { type: 'boolean', description: '是否为 full 数据（含一年前历史数据），默认 false。' },
      },
      required: ['query'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string' },
          total: { type: 'integer', description: '匹配总数（FOFA size 字段）' },
          page: { type: 'integer', description: '本次请求的页码' },
          size: { type: 'integer', description: '本次请求的条数' },
          fields: { type: 'string', description: '本次请求的字段列表' },
          uniqueIps: { type: 'integer', description: '本页去重后的 IP 数' },
          rows: {
            type: 'array',
            description: '本页结果行；列集合由 fields 决定，值保持 FOFA 原始形态',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: ROW_FIELD_PROPERTIES,
            },
          },
        },
        required: ['query', 'total', 'page', 'size', 'fields', 'uniqueIps', 'rows'],
      },
      render: (_args, value) => [{ type: 'text', text: renderSearch(value) }],
      // Durable card facts: the rows below are a bounded preview so a spilled
      // model-facing result still renders a useful card on replay.
      presentationMeta: (_args, value) => ({
        kind: 'search',
        query: value.query,
        total: value.total,
        page: value.page,
        size: value.size,
        fields: value.fields,
        uniqueIps: value.uniqueIps,
        rowCount: Array.isArray(value.rows) ? value.rows.length : 0,
        rows: Array.isArray(value.rows) ? presentationRows(value.rows) : [],
      }),
    },
    timeoutMs: config.timeoutMs * config.retries + 30000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      if (query === '') throw new Error('query 不能为空：请传入 FOFA 查询语句，例如 domain="example.com"。');
      const size = clampNumber(args.size, 50, 1, MAX_SEARCH_SIZE);
      const page = clampNumber(args.page, 1, 1, 100);
      const fields = text(args.fields, config.defaultFields);
      const full = args.full === true;
      const resolved = await keyOrThrow(ctx, config);
      try {
        const result = await searchPage({ config, key: resolved.key, query, size, page, fields, full, signal: exec.signal });
        const ips = new Set();
        for (const row of result.rows) {
          const ip = row.ip === undefined || row.ip === null ? '' : String(row.ip);
          if (ip !== '') ips.add(ip);
        }
        return {
          query,
          total: result.total,
          page,
          size,
          fields,
          uniqueIps: ips.size,
          rows: result.rows,
        };
      } catch (error) {
        throw new Error(explainApiError(error));
      }
    },
  };

  const exportTool = {
    name: 'fofa_export',
    description:
      '按查询语句全量拉取（自动用 before 游标翻页，可超过 1 万条）并增量写入工作区文件。每批请求后立即落盘：时间预算用尽或中途失败时已拉取的行不会丢失，可传 appendTo 断点续拉。支持 CSV（UTF-8 BOM，Excel 可直接打开）、TXT（URL/IP 列表）与 JSON。注意：会消耗多次查询额度，动手前先 fofa_account。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description: 'FOFA 查询语句；多个目标可用 || 合并，例如 domain="a.com" || domain="b.com" || ip="1.2.3.4"。续拉时可省略（沿用元数据里的语句）。',
        },
        limit: {
          type: 'integer',
          description: '本次最多拉取条数，默认 1000；0 表示按匹配总数（受配置 maxExportRows 上限保护）。续拉时表示本次新增条数。',
        },
        format: {
          type: 'string',
          enum: ['csv', 'json', 'txt'],
          description: '导出格式，默认 csv；续拉时忽略（沿用文件格式）。',
        },
        fields: FIELDS_PARAM,
        dedup: {
          type: 'string',
          description: '去重字段（逗号分隔），默认按导出字段去重；常用 url、ip、ip,host、domain。',
        },
        fill: {
          type: 'number',
          description: '拉取比例 (0,1]，默认 1（即 limit 与总数取小）。总量极大时可用 0.8 省额度。',
        },
        fileName: {
          type: 'string',
          description: '输出文件名（不含目录），缺省自动用 fofa_results_时间戳。',
        },
        appendTo: {
          type: 'string',
          description: '断点续拉：传上次结果里的 path（或 path.meta.json），从保存的游标继续追加到同一文件，不重复消耗已拉部分；JSON 不支持续拉。',
        },
        full: {
          type: 'boolean',
          description: '是否为 full 数据（含一年前历史数据），默认 false。',
        },
      },
      required: [],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: '导出文件的绝对路径' },
          metaPath: { type: 'string', description: '续拉元数据（侧车）路径' },
          format: { type: 'string', enum: ['csv', 'json', 'txt'] },
          query: { type: 'string' },
          total: { type: 'integer', description: '查询匹配总数' },
          written: { type: 'integer', description: '文件当前总行数（含续拉前已有行）' },
          newRows: { type: 'integer', description: '本次新增行数' },
          rowsFetched: { type: 'integer', description: '本次从接口取回的行数（去重前）' },
          apiCalls: { type: 'integer' },
          batches: { type: 'integer' },
          partial: { type: 'boolean', description: 'true 表示未拉完，已落盘部分仍有效' },
          stoppedReason: {
            type: 'string',
            enum: ['exhausted', 'limit', 'complete', 'time-budget', 'batch-cap', 'upstream-error', 'empty'],
          },
          nextBefore: {
            description: 'FOFA 时间游标；null 表示没有剩余数据（可直接用于 appendTo 续拉）',
            oneOf: [{ type: 'string' }, { type: 'null' }],
          },
          durationMs: { type: 'integer' },
          resumed: { type: 'boolean', description: '本次是否为 appendTo 续拉' },
          dedup: { type: 'string', description: '去重字段（逗号分隔）' },
          fields: { type: 'string', description: '实际导出的列（逗号分隔，含补入的去重列）' },
          budgetSeconds: { type: 'integer', description: '本次导出的时间预算（秒）' },
        },
        required: [
          'path',
          'metaPath',
          'format',
          'query',
          'total',
          'written',
          'newRows',
          'rowsFetched',
          'apiCalls',
          'batches',
          'partial',
          'stoppedReason',
          'nextBefore',
          'durationMs',
          'resumed',
          'dedup',
          'fields',
          'budgetSeconds',
        ],
      },
      render: (_args, value) => [{ type: 'text', text: renderExport(value) }],
      presentationMeta: (_args, value) => ({
        kind: 'export',
        path: value.path,
        metaPath: value.metaPath,
        format: value.format,
        query: value.query,
        total: value.total,
        written: value.written,
        newRows: value.newRows,
        rowsFetched: value.rowsFetched,
        apiCalls: value.apiCalls,
        batches: value.batches,
        partial: value.partial,
        stoppedReason: value.stoppedReason,
        nextBefore: value.nextBefore,
        durationMs: value.durationMs,
        resumed: value.resumed,
        dedup: value.dedup,
        fields: value.fields,
        budgetSeconds: value.budgetSeconds,
      }),
    },
    timeoutMs: (config.maxExportSeconds + 60) * 1000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const startedAt = Date.now();
      const appendToRaw = typeof args.appendTo === 'string' ? args.appendTo.trim() : '';
      let query = typeof args.query === 'string' ? args.query.trim() : '';
      const formatArg = ['csv', 'json', 'txt'].includes(args.format) ? args.format : 'csv';
      const limit = clampNumber(args.limit, 1000, 0, MAX_EXPORT_ROWS_CAP);
      if (limit > config.maxExportRows) {
        throw new Error(`limit=${limit} 超过配置上限 maxExportRows=${config.maxExportRows}：请调小 limit，或调大插件配置里的 maxExportRows。`);
      }
      const requested = fieldList(text(args.fields, config.defaultFields));
      const dedupFields = fieldList(typeof args.dedup === 'string' ? args.dedup : '');
      const resolved = await keyOrThrow(ctx, config);
      const baseDirectory = await sessionBaseDirectory(ctx, exec);

      let path = '';
      let format = formatArg;
      let columns = [];
      let mode = 'url';
      let startBefore = '';
      let knownTotal = 0;
      let append = false;
      let resumedCount = 0;
      if (appendToRaw !== '') {
        path = isAbsolute(appendToRaw) ? appendToRaw : resolvePath(baseDirectory, appendToRaw);
        const meta = await readExportMeta(path);
        format = typeof meta.format === 'string' ? meta.format : formatArg;
        if (args.format !== undefined && formatArg !== format) {
          throw new Error(`续拉格式不一致：已有文件是 ${format}，本次传了 ${formatArg}。`);
        }
        if (query === '') query = typeof meta.query === 'string' ? meta.query : '';
        if (query === '' || query !== meta.query) {
          throw new Error('续拉必须使用与元数据相同的 query：请省略 query 或传入上次的语句。');
        }
        columns = Array.isArray(meta.columns) ? meta.columns.filter((item) => typeof item === 'string') : fieldList(meta.fields);
        if (columns.length === 0) throw new Error('续拉元数据缺少字段列表，无法继续；请重新全量导出。');
        mode = typeof meta.mode === 'string' ? meta.mode : txtMode(columns);
        startBefore = typeof meta.nextBefore === 'string' ? meta.nextBefore : '';
        if (startBefore === '') throw new Error('该导出已完成（没有剩余游标），无需续拉；需要重新拉取请不传 appendTo。');
        knownTotal = Number.isFinite(Number(meta.total)) ? Number(meta.total) : 0;
        resumedCount = Number.isFinite(Number(meta.written)) ? Number(meta.written) : 0;
        append = true;
      } else {
        if (query === '') throw new Error('query 不能为空：请传入 FOFA 查询语句，例如 domain="example.com"。');
        columns = [...requested];
        for (const field of dedupFields) if (!columns.includes(field)) columns.push(field);
        mode = format === 'txt' ? txtMode(columns) : 'url';
      }

      const budget = new AbortController();
      const budgetTimer = setTimeout(() => budget.abort(new ExportBudgetError()), config.maxExportSeconds * 1000);
      let sink;
      try {
        if (!append) {
          const baseName = sanitizeFileName(text(args.fileName, `fofa_results_${timestamp()}`));
          const directory = await resolveOutputDir(ctx, config, exec);
          await mkdir(directory, { recursive: true });
          path = await uniquePath(join(directory, `${baseName}.${format}`));
        }
        sink = await openSink({ path, format, columns, mode, append, initialCount: resumedCount });
        const summary = await fetchInto({
          config,
          key: resolved.key,
          query,
          limit,
          fill: typeof args.fill === 'number' ? args.fill : 1,
          columns,
          sink,
          full: args.full === true,
          signal: exec.signal,
          budgetSignal: budget.signal,
          startBefore,
          knownTotal,
        });
        await sink.close();
        await writeExportMeta(path, {
          format,
          query,
          fields: requested.join(','),
          columns,
          mode,
          dedup: dedupFields.join(','),
          total: summary.total,
          written: sink.count,
          nextBefore: summary.nextBefore,
          partial: summary.partial,
          stoppedReason: summary.stoppedReason,
        });
        if (summary.error !== undefined) {
          // Partial data is already on disk; surface the cause in the log and
          // still answer with the usable file instead of failing the call.
          console.warn(`${TAG} export stopped early: ${summary.error instanceof Error ? summary.error.message : String(summary.error)}`);
        }
        return {
          path,
          metaPath: metaPathOf(path),
          format,
          query,
          total: summary.total,
          written: sink.count,
          newRows: summary.newRows,
          rowsFetched: summary.rowsFetched,
          apiCalls: summary.apiCalls,
          batches: summary.batches,
          partial: summary.partial,
          stoppedReason: summary.stoppedReason,
          nextBefore: summary.nextBefore,
          durationMs: Date.now() - startedAt,
          resumed: append,
          dedup: dedupFields.join(','),
          fields: columns.join(','),
          budgetSeconds: config.maxExportSeconds,
        };
      } catch (error) {
        if (sink !== undefined) {
          try {
            await sink.close();
          } catch {
            // Best effort: keep the original error.
          }
        }
        // A hard failure before any row left no useful file behind.
        if (sink !== undefined && sink.count === 0 && !append) {
          try {
            await unlink(path);
            await unlink(metaPathOf(path));
          } catch {
            // Ignore cleanup failures.
          }
        }
        throw new Error(explainApiError(error));
      } finally {
        clearTimeout(budgetTimer);
      }
    },
  };

  ctx.effect(() => ctx.tools.register(accountTool), 'dsh-fofatoto: fofa_account');
  ctx.effect(() => ctx.tools.register(searchTool), 'dsh-fofatoto: fofa_search');
  ctx.effect(() => ctx.tools.register(exportTool), 'dsh-fofatoto: fofa_export');
  return [accountTool.name, searchTool.name, exportTool.name];
}

/** Timestamp used for default export file names. */
function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** Keep an export file name inside the output directory. */
function sanitizeFileName(name) {
  const base = basename(String(name)).replace(/[\\/:*?"<>|\u0000-\u001f]/gu, '_').trim();
  if (base === '' || base === '.' || base === '..') return `fofa_results_${timestamp()}`;
  return base.replace(/\.(csv|json|txt)$/iu, '');
}

/* ------------------------------------------------------------------ */
/* Settings routes (Plugins page card)                                 */
/* ------------------------------------------------------------------ */

/** JSON response helper. */
function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** Read one bounded JSON request body. */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw === '') return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed !== null && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** Save or clear the API key in the Harness credential store. */
async function writeApiKey(ctx, config, apiKey) {
  const credentials = ctx.get('credentials');
  if (credentials === void 0 || typeof credentials.set !== 'function') {
    throw new Error('Harness 凭据服务不可用，无法保存 API Key；请改用环境变量 FOFA_KEY 或插件配置 apiKey。');
  }
  if (apiKey === '') {
    if (typeof credentials.unset !== 'function') {
      throw new Error('Harness 凭据服务不支持删除 Key，无法清除已保存的 API Key。');
    }
    await credentials.unset(config.credentialRef);
    return;
  }
  if (apiKey.length < 6 || apiKey.length > 512) {
    throw new Error('API Key 长度应在 6–512 字符之间，请检查是否复制完整。');
  }
  await credentials.set(config.credentialRef, apiKey);
}

/** Register the same-origin settings routes used by the Plugins page card. */
function registerRoutes(ctx, webServer, config) {
  const handler = async (req, res) => {
    // Plugin routes are loopback-open, so require a custom header: it makes the
    // card's requests non-simple and unreachable for a cross-origin page.
    if (req.headers['x-dsh-fofatoto-plugin'] !== '1') {
      sendJson(res, 403, { ok: false, error: 'forbidden' });
      return;
    }
    let url;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid url' });
      return;
    }
    const sub = url.pathname.startsWith(ROUTE_PREFIX) ? url.pathname.slice(ROUTE_PREFIX.length) : '';
    try {
      if (req.method === 'GET' && sub === '/settings') {
        sendJson(res, 200, await keyStatus(ctx, config));
        return;
      }
      if (req.method === 'POST' && sub === '/settings') {
        const body = await readJsonBody(req);
        const clearing = body.clear === true;
        const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        const wantsKey = clearing || apiKey !== '';
        const wantsBaseUrl = typeof body.baseUrl === 'string';
        if (!wantsKey && !wantsBaseUrl) {
          sendJson(res, 200, { ok: false, error: '缺少 apiKey / clear / baseUrl 字段' });
          return;
        }
        const editable = canEditConfig(ctx);
        let nextBaseUrl = config.baseUrl;
        let reconfigRequested = false;
        if (wantsBaseUrl) {
          const candidate = normalizeBaseUrl(body.baseUrl, '');
          if (candidate === '') {
            sendJson(res, 200, { ok: false, error: '接口地址不合法：需要 http(s) 开头的完整 URL，例如 https://fofa.info' });
            return;
          }
          if (candidate !== config.baseUrl) {
            if (!editable) {
              sendJson(res, 200, {
                ok: false,
                error: '当前环境不支持在插件页保存接口地址：请修改本 profile 的 cordis.patch.yml 中 dsh-fofatoto 行的 baseUrl。',
              });
              return;
            }
            nextBaseUrl = candidate;
            reconfigRequested = true;
          }
        }
        // Resolve the key before mutating: the config edit reloads this plugin.
        const current = await resolveApiKey(ctx, config);
        let resolved = current;
        if (wantsKey) {
          try {
            await writeApiKey(ctx, config, clearing ? '' : apiKey);
          } catch (error) {
            // User-input problems stay in-band so the card can show them.
            sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
            return;
          }
          resolved = clearing ? { key: '', source: 'none' } : { key: apiKey, source: 'credential' };
        }
        let reconfigApplied = false;
        if (reconfigRequested) {
          try {
            await saveEndpointConfig(ctx, { baseUrl: nextBaseUrl });
            reconfigApplied = true;
          } catch (error) {
            sendJson(res, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
            return;
          }
        }
        const status = buildStatus({ ...config, baseUrl: nextBaseUrl }, resolved, editable);
        const result = clearing ? { ...status, cleared: true } : { ...status, saved: true };
        if (reconfigApplied) result.reconfigApplied = true;
        sendJson(res, 200, result);
        return;
      }
      if (req.method === 'POST' && sub === '/test') {
        const body = await readJsonBody(req);
        const override = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        let effective = config;
        try {
          if (typeof body.baseUrl === 'string' && body.baseUrl.trim() !== '') {
            const candidate = normalizeBaseUrl(body.baseUrl, '');
            if (candidate === '') throw new Error('接口地址不合法：需要 http(s) 开头的完整 URL');
            effective = { ...effective, baseUrl: candidate };
          }
        } catch (error) {
          sendJson(res, 200, {
            ok: false,
            httpStatus: 0,
            apiCode: null,
            msg: error instanceof Error ? error.message : String(error),
            latencyMs: 0,
            source: override !== '' ? 'input' : 'none',
            quota: { type: 'unknown', valid: false },
          });
          return;
        }
        const resolved = override !== '' ? { key: override, source: 'input' } : await resolveApiKey(ctx, effective);
        if (resolved.key === '') {
          sendJson(res, 200, {
            ok: false,
            httpStatus: 0,
            apiCode: null,
            msg: '尚未配置 API Key，无法测试。',
            latencyMs: 0,
            source: resolved.source,
            quota: { type: 'unknown', valid: false },
          });
          return;
        }
        const startedAt = Date.now();
        try {
          const { account, httpStatus } = await fetchAccount({ config: effective, key: resolved.key, signal: new AbortController().signal });
          sendJson(res, 200, {
            ok: account.valid === true,
            httpStatus,
            apiCode: null,
            msg: account.valid === true ? '连接成功' : '接口拒绝该 Key',
            latencyMs: Date.now() - startedAt,
            source: resolved.source,
            quota: {
              type: account.type,
              valid: account.valid,
              todayRemaining: account.todayRemaining ?? undefined,
              remainApiQuery: account.remainApiQuery ?? undefined,
              expiration: account.expiration || undefined,
            },
          });
        } catch (error) {
          const detail =
            error instanceof FofaApiError && error.fofaError !== ''
              ? `${error.message}：${error.fofaError}`
              : error instanceof Error
                ? error.message
                : String(error);
          sendJson(res, 200, {
            ok: false,
            httpStatus: error instanceof FofaApiError ? error.httpStatus : 0,
            apiCode: error instanceof FofaApiError ? error.apiCode : null,
            msg: detail,
            latencyMs: Date.now() - startedAt,
            source: resolved.source,
            quota: { type: 'unknown', valid: false },
          });
        }
        return;
      }
      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
  return webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler });
}

/** Cordis plugin name for loader diagnostics. */
export const name = 'dsh-fofatoto';

/** The tool registry is a hard dependency; webServer/credentials are optional. */
export const inject = ['tools'];

/**
 * Mount the settings routes once a live `webServer` exists. This plugin can
 * activate before the web host does, so `ctx.get('webServer')` is followed by a
 * reactive `ctx.inject` that fires when the service mounts.
 */
function mountSettingsRoutes(ctx, config) {
  let mounted = false;
  const mount = (hostCtx) => {
    if (mounted) return;
    const webServer = hostCtx.get('webServer');
    if (webServer === void 0 || typeof webServer.register !== 'function') return;
    mounted = true;
    hostCtx.effect(() => registerRoutes(hostCtx, webServer, config), 'dsh-fofatoto: settings routes');
  };
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (webCtx) => mount(webCtx));
  }
  mount(ctx);
  if (!mounted) {
    console.info(`${TAG} webServer not available yet; settings routes will mount when it appears`);
  }
}

/** Cordis plugin entry. */
export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig);
  registerTools(ctx, config);
  mountSettingsRoutes(ctx, config);
}

/** Exported for local tests only; not part of the plugin contract. */
export const __test = {
  ALL_FIELD_NAMES,
  DEFAULT_FIELDS,
  DEFAULT_FIELD_LIST,
  accountSummary,
  apiFieldsFor,
  appendMissingFields,
  buildStatus,
  buildUrl,
  combineSignals,
  csvCell,
  dedupKey,
  detectAccountEndpoint,
  expandAccountEndpoint,
  explainApiError,
  exportSummary,
  fetchAccount,
  fetchInto,
  fieldList,
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
  retrySleepSeconds,
  sanitizeFileName,
  saveEndpointConfig,
  scalarOrNull,
  searchPage,
  searchSummary,
  textOrEmpty,
  txtLine,
  txtMode,
  uniquePath,
  writeExportMeta,
};
