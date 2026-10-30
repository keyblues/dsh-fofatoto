/**
 * FOFA 网络空间测绘 (fofatoto) — DSH Client half.
 *
 * Renders the API-key configuration card inside this bundle's page on the
 * Plugins page (`plugins.bundle.config`, keyed by the bundle package name),
 * exactly like the shipped "思考过程机器翻译" bundle: no separate settings
 * page, everything is configured where the plugin itself is listed.
 *
 * The card only talks to the Host half's same-origin routes; the API key is
 * written to the Harness credential store and never sent back to the page.
 * Besides the key, it exposes the two user-editable endpoints (base URL and
 * the account-info API template) unless the Host marks them as pinned by the
 * profile's cordis.patch.yml (`editable: false`).
 */
window.__ModuleLoader__.load({
  id: 'dsh-fofatoto',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace shared with the Host bundle metadata. */
    const NS = 'dsh-fofatoto';
    /**
     * Same-origin Host routes (must stay in sync with ROUTE_PREFIX in index.js).
     * Every request carries the `x-dsh-fofatoto-plugin: 1` guard header, which
     * the Host half rejects with 403 when missing.
     */
    const ROUTE_SETTINGS = '/plugins/dsh-fofatoto/settings';
    const ROUTE_TEST = '/plugins/dsh-fofatoto/test';

    const DICT = {
      en: {
        title: 'FOFATOTO',
        'status.loading': 'Reading configuration…',
        'status.configured': 'Configured',
        'status.missing': 'No API key yet',
        'source.credential': 'Harness credentials',
        'source.config': 'plugin config',
        'source.env': 'environment variable',
        'source.file': 'fofatoto config',
        'source.none': 'none',
        keyLabel: 'API key',
        keyPlaceholder: 'Paste the FOFA API key (or the fafaapi.info relay key)',
        baseUrlLabel: 'Base URL',
        baseUrlPlaceholder: 'https://fofa.info',
        endpointNotEditable: "Base URL is pinned by this profile's cordis.patch.yml; edit that file to change it.",
        invalidBaseUrl: 'Base URL must be a valid http(s) URL.',
        endpointSavedRestart: 'Saved; restart Harness to apply.',
        save: 'Save',
        saving: 'Saving…',
        test: 'Test connection',
        testing: 'Testing…',
        clear: 'Remove key',
        clearing: 'Removing…',
        confirmClear: 'Remove the stored FOFA API key?',
        saved: 'Saved.',
        cleared: 'API key removed.',
        testOk: 'Connection works',
        testFailed: 'Connection failed',
        loadFailed: 'The configuration route is unreachable. Reload the page and retry.',
        invalidDraft: 'Paste a complete API key first.',
        hintStorage:
          'The key is stored in the local Harness credential store (never written to the profile settings file and never echoed back); only the last characters are shown. The environment variable FOFA_KEY and the plugin config field apiKey are also accepted.',
        hintGenerate:
          'Get the key in FOFA under Personal center → API key, or from the fafaapi.info relay console; the full key is shown only once.',
        endpoint: 'Endpoint',
        quotaRelay: 'Relay',
        quotaStandard: 'Standard',
        quotaToday: 'today left',
        quotaRemain: 'queries left',
        quotaExpiration: 'expires',
        'tool.account': 'FOFA account',
        'tool.search': 'FOFA search',
        'tool.export': 'FOFA export',
        'tool.preparing': 'Preparing…',
        'tool.running': 'running',
        'tool.done': 'done',
        'tool.failed': 'failed',
        'tool.query': 'query',
        'tool.file': 'file',
        'tool.size': 'rows requested',
        'tool.page': 'page',
        'tool.fields': 'fields',
        'tool.limit': 'row limit',
        'tool.all': 'all (capped)',
        'tool.defaultLimit': 'default 1000',
        'tool.fill': 'fill',
        'tool.full': 'include history',
        'tool.rows': 'rows',
        'tool.hit': 'matches',
        'tool.hitUnit': '',
        'tool.pageRows': 'on this page',
        'tool.total': 'total matches',
        'tool.calls': 'API calls',
        'tool.duration': 'duration',
        'tool.dedup': 'dedup by',
        'tool.cursor': 'cursor',
        'tool.more': '…and',
        'tool.noRows': 'No rows on this page.',
        'tool.accountType': 'account',
        'tool.valid': 'valid',
        'tool.invalid': 'invalid key',
        'tool.yes': 'yes',
        'tool.no': 'no',
        'tool.today': 'today left',
        'tool.remain': 'queries left',
        'tool.expiration': 'expires',
        'tool.firstUsed': 'first used',
        'tool.vipLevel': 'VIP level',
        'tool.server': 'server',
        'tool.endpoint': 'endpoint',
        'tool.format': 'format',
        'tool.written': 'written',
        'tool.status': 'state',
        'tool.partial': 'partial',
        'tool.spilled': 'The full result was spilled to disk; this card shows the durable preview.',
        'tool.retryHint': 'Not finished yet: rerun with appendTo to continue.',
        'tool.relay': 'relay',
        'tool.standard': 'standard',
        'tool.reason.exhausted': 'exhausted',
        'tool.reason.limit': 'row limit',
        'tool.reason.complete': 'complete',
        'tool.reason.time-budget': 'time budget',
        'tool.reason.batch-cap': 'batch cap',
        'tool.reason.upstream-error': 'upstream error',
        'tool.reason.empty': 'no matches',
      },
      zh: {
        title: 'FOFATOTO',
        'status.loading': '正在读取配置…',
        'status.configured': '已配置',
        'status.missing': '尚未配置 API Key',
        'source.credential': 'Harness 凭据库',
        'source.config': '插件配置',
        'source.env': '环境变量',
        'source.file': 'fofatoto 配置',
        'source.none': '无',
        keyLabel: 'API Key',
        keyPlaceholder: '粘贴 FOFA API Key（或中转站 fafaapi.info 的 Key）',
        baseUrlLabel: '接口地址',
        baseUrlPlaceholder: 'https://fofa.info',
        endpointNotEditable: '接口地址由本 profile 的 cordis.patch.yml 固定，只读；如需修改请编辑该文件。',
        invalidBaseUrl: '接口地址需为 http(s) 开头的合法 URL。',
        endpointSavedRestart: '已保存；重启 Harness 后生效。',
        save: '保存',
        saving: '保存中…',
        test: '测试连接',
        testing: '测试中…',
        clear: '清除 Key',
        clearing: '清除中…',
        confirmClear: '确定要删除已保存的 FOFA API Key 吗？',
        saved: '已保存。',
        cleared: 'API Key 已清除。',
        testOk: '连接正常',
        testFailed: '连接失败',
        loadFailed: '配置接口不可达，请刷新页面重试。',
        invalidDraft: '请先粘贴完整的 API Key。',
        hintStorage:
          'Key 保存在本机 Harness 凭据库（不写入 profile 配置文件、不回显），页面只显示尾号；也支持环境变量 FOFA_KEY 或插件配置 apiKey。',
        hintGenerate:
          'Key 获取方式：FOFA 个人中心 → API 密钥（或中转站 fafaapi.info 的 Key）。',
        endpoint: '接口地址',
        quotaRelay: '中转站',
        quotaStandard: '标准版',
        quotaToday: '今日剩余',
        quotaRemain: '剩余查询',
        quotaExpiration: '到期',
        'tool.account': 'FOFA 账号',
        'tool.search': 'FOFA 检索',
        'tool.export': 'FOFA 导出',
        'tool.preparing': '准备中…',
        'tool.running': '执行中',
        'tool.done': '完成',
        'tool.failed': '失败',
        'tool.query': '语句',
        'tool.file': '文件',
        'tool.size': '条数',
        'tool.page': '页码',
        'tool.fields': '字段',
        'tool.limit': '条数上限',
        'tool.all': '全部（受上限保护）',
        'tool.defaultLimit': '默认 1000',
        'tool.fill': '比例',
        'tool.full': '含历史数据',
        'tool.rows': '行',
        'tool.hit': '命中',
        'tool.hitUnit': '条',
        'tool.pageRows': '本页',
        'tool.total': '总匹配',
        'tool.calls': '接口调用',
        'tool.duration': '耗时',
        'tool.dedup': '去重字段',
        'tool.cursor': '游标',
        'tool.more': '…另有',
        'tool.noRows': '本页没有结果。',
        'tool.accountType': '账户类型',
        'tool.valid': 'Key 状态',
        'tool.invalid': 'Key 无效',
        'tool.yes': '有效',
        'tool.no': '无效',
        'tool.today': '今日剩余',
        'tool.remain': '剩余查询',
        'tool.expiration': '到期',
        'tool.firstUsed': '首次使用',
        'tool.vipLevel': 'VIP 等级',
        'tool.server': 'fofa_server',
        'tool.endpoint': '接口',
        'tool.format': '格式',
        'tool.written': '已写入',
        'tool.status': '停止原因',
        'tool.partial': '部分完成',
        'tool.spilled': '结果过大已落盘（spill），卡片显示的是持久化预览。',
        'tool.retryHint': '还没拉完：可用 appendTo 续拉。',
        'tool.relay': '中转站',
        'tool.standard': '标准版',
        'tool.reason.exhausted': '已取完',
        'tool.reason.limit': '达到条数上限',
        'tool.reason.complete': '完成',
        'tool.reason.time-budget': '时间预算用尽',
        'tool.reason.batch-cap': '批次上限',
        'tool.reason.upstream-error': '上游错误',
        'tool.reason.empty': '无结果',
      },
    };

    /** Best-effort locale for the module-level fallback translator. */
    function detectLocale() {
      try {
        const lang = (document.documentElement.lang || navigator.language || 'en').toLowerCase();
        return lang.startsWith('zh') ? 'zh' : 'en';
      } catch {
        return 'en';
      }
    }

    /** Local dictionary fallback used when the page does not supply `t`. */
    function fallbackTranslate(key) {
      const dict = DICT[detectLocale()] ?? DICT.en;
      return dict[key] ?? DICT.en[key] ?? key;
    }

    /** Translate through the page's bound `t`, falling back to our own dictionary. */
    function makeTranslator(bound) {
      if (typeof bound !== 'function') return fallbackTranslate;
      return (key) => {
        let value;
        try {
          value = bound(key);
        } catch {
          return fallbackTranslate(key);
        }
        return value === undefined || value === key ? fallbackTranslate(key) : value;
      };
    }

    /**
     * One endpoint template from the Host.
     * @param {unknown} value raw status field
     * @returns {string} trimmed string, or '' when the field is not a string
     */
    function asText(value) {
      return typeof value === 'string' ? value.trim() : '';
    }

    /**
     * True only for an absolute http(s) URL — the Host rejects anything else.
     * @param {string} value candidate base URL
     * @returns {boolean} whether `new URL` accepts it over http/https
     */
    function isValidBaseUrl(value) {
      const text = asText(value);
      if (text === '') return false;
      try {
        const url = new URL(text);
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    }

    /** True when a quota field carries a printable value (0 is valid, null/undefined/'' is not). */
    function hasValue(value) {
      if (typeof value === 'number') return Number.isFinite(value);
      if (typeof value === 'string') return value.trim() !== '';
      return false;
    }

    /** Render one quota field without ever printing `undefined`/`null`, or '' when absent. */
    function quotaField(label, value) {
      if (!hasValue(value)) return '';
      const text = String(value).trim();
      return text === '' ? '' : `${label} ${text}`;
    }

    /** Build the quota summary line (`中转站 · 今日剩余 96 · 到期 2026-11-08`), omitting missing parts. */
    function formatQuota(quota, t) {
      if (quota === null || typeof quota !== 'object') return '';
      const parts = [];
      if (quota.type === 'relay') parts.push(t('quotaRelay'));
      else if (quota.type === 'standard') parts.push(t('quotaStandard'));
      parts.push(quotaField(t('quotaToday'), quota.todayRemaining));
      parts.push(quotaField(t('quotaRemain'), quota.remainApiQuery));
      parts.push(quotaField(t('quotaExpiration'), quota.expiration));
      return parts.filter((part) => part !== '').join(' · ');
    }

    /* -------------------------------------------------------------- */
    /* Tool-call cards (keyed `tool.call.toolview` slot)              */
    /* -------------------------------------------------------------- */

    /** Localized title of one FOFA wire tool. */
    function toolTitle(t, toolName) {
      if (toolName === 'fofa_account') return t('tool.account');
      if (toolName === 'fofa_search') return t('tool.search');
      if (toolName === 'fofa_export') return t('tool.export');
      return toolName;
    }

    /** Shorten a display string to `max` code points. */
    function clip(value, max) {
      const text = value === null || value === undefined ? '' : String(value);
      const chars = Array.from(text);
      return chars.length <= max ? text : `${chars.slice(0, max).join('')}…`;
    }

    /** Parse the model arguments of one tool block at any call stage. */
    function blockArgs(block) {
      if (block === null || block === undefined) return null;
      const raw = typeof block.kind === 'string' ? (block.call === undefined ? undefined : block.call.argsRaw) : block.argsRaw;
      if (typeof raw !== 'string' || raw === '') return null;
      try {
        const parsed = JSON.parse(raw);
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }

    /** Join every text block of one settled tool result. */
    function blockText(block) {
      const content = block !== null && block !== undefined && Array.isArray(block.content) ? block.content : [];
      return content
        .filter((entry) => entry !== null && typeof entry === 'object' && entry.type === 'text' && typeof entry.text === 'string')
        .map((entry) => entry.text)
        .join('\n');
    }

    /**
     * Parse the canonical JSON body out of one settled result. Current renders
     * are `<summary>\n<compact JSON>`; older session logs carry bare JSON.
     */
    function blockValue(block) {
      const text = blockText(block);
      if (text === '') return null;
      const lines = text.split('\n');
      const index = lines.findIndex((line) => line.startsWith('{'));
      const candidate = index === -1 ? text : lines.slice(index).join('\n');
      try {
        const value = JSON.parse(candidate);
        return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
      } catch {
        return null;
      }
    }

    /** One failed-call message without the `Error: ` envelope. */
    function blockError(block) {
      return blockText(block).replace(/^Error:\s*/u, '');
    }

    /**
     * Durable card facts persisted as `result.meta` by `output.presentationMeta`.
     * They survive a spilled (disk-backed) model-facing content.
     */
    function blockMeta(block) {
      const meta = block === null || block === undefined ? undefined : block.meta;
      return meta !== null && typeof meta === 'object' && !Array.isArray(meta) && typeof meta.kind === 'string' ? meta : null;
    }

    /** Whether the settled content is a spill locator rather than the render body. */
    function contentSpilled(block) {
      return /Full formatted result stored at|结果已落盘|spill/iu.test(blockText(block));
    }

    /** One labeled key/value row. */
    function kvRow(t, key, value) {
      const text = value === null || value === undefined || value === '' ? '—' : String(value);
      return h('div', { className: 'fft_kv' }, h('span', { className: 'fft_k' }, t(key)), h('span', { className: 'fft_v' }, text));
    }

    /** One full-width configuration line (`语句: domain="…"`), monospaced. */
    function cfgLine(t, key, value) {
      const text = value === null || value === undefined || value === '' ? '—' : String(value);
      return h(
        'div',
        { className: 'fft_cfgLine' },
        h('span', { className: 'fft_k' }, t(key)),
        h('span', { className: 'fft_v fft_mono' }, text),
      );
    }

    /**
     * Localized "requested rows" text for an export call. The request (limit,
     * fill) lives in the model arguments, not in the returned canonical value.
     */
    function requestedRows(t, args) {
      const limit = args === null || args === undefined ? undefined : args.limit;
      if (limit === 0) return t('tool.all');
      if (Number.isInteger(limit)) return String(limit);
      return t('tool.defaultLimit');
    }

    /** Human label for one export `stoppedReason`. */
    function reasonLabel(t, reason) {
      if (typeof reason !== 'string' || reason === '') return '—';
      return t(`tool.reason.${reason}`);
    }

    /** Summary line of one settled tool value. */
    function toolSummary(t, toolName, value) {
      if (toolName === 'fofa_account') {
        const account = value.account !== null && typeof value.account === 'object' ? value.account : {};
        return [
          account.type === 'relay' ? t('tool.relay') : account.type === 'standard' ? t('tool.standard') : '',
          account.valid === true ? t('tool.yes') : t('tool.no'),
          hasValue(account.todayRemaining) ? `${t('tool.today')} ${account.todayRemaining}` : '',
        ]
          .filter((part) => part !== '')
          .join(' · ');
      }
      if (toolName === 'fofa_search') {
        const rows = Array.isArray(value.rows) ? value.rows.length : 0;
        const query = typeof value.query === 'string' ? value.query : '';
        const head = [t('tool.hit'), String(value.total === undefined ? 0 : value.total), t('tool.hitUnit')]
          .filter((part) => part !== '')
          .join(' ');
        return query === '' ? `${head} · ${t('tool.pageRows')} ${rows}` : `${head} · ${clip(query, 72)}`;
      }
      return [
        typeof value.format === 'string' ? value.format : '',
        Number.isInteger(value.written) ? `${value.written} ${t('tool.rows')}` : '',
        value.partial === true ? t('tool.partial') : '',
        typeof value.query === 'string' && value.query !== '' ? clip(value.query, 72) : '',
      ]
        .filter((part) => part !== '')
        .join(' · ');
    }

    /** Body nodes of one settled tool value. */
    function toolBody(t, toolName, value, args, openFile) {
      if (toolName === 'fofa_account') {
        const account = value.account !== null && typeof value.account === 'object' ? value.account : {};
        const type = account.type === 'relay' ? t('tool.relay') : account.type === 'standard' ? t('tool.standard') : account.type;
        return [
          h(
            'div',
            { className: 'fft_kvs' },
            kvRow(t, 'tool.accountType', type),
            kvRow(t, 'tool.valid', account.valid === true ? t('tool.yes') : t('tool.no')),
            kvRow(t, 'tool.today', account.todayRemaining),
            kvRow(t, 'tool.remain', account.remainApiQuery),
            kvRow(t, 'tool.expiration', account.expiration),
            kvRow(t, 'tool.firstUsed', account.firstUsed),
            kvRow(t, 'tool.vipLevel', account.vipLevel),
            kvRow(t, 'tool.server', account.server),
            kvRow(t, 'tool.endpoint', account.baseUrl),
          ),
          h('div', { className: 'fft_meta' }, `HTTP ${value.httpStatus === undefined ? '—' : value.httpStatus} · ${t(`source.${value.source === undefined ? 'none' : value.source}`)}`),
        ];
      }
      if (toolName === 'fofa_search') {
        const rows = Array.isArray(value.rows) ? value.rows : [];
        const columns = ['host', 'ip', 'port', 'title'];
        const shown = rows.slice(0, 8);
        const rowCount = Number.isInteger(value.rowCount) ? value.rowCount : rows.length;
        const nodes = [
          h(
            'div',
            { className: 'fft_cfg' },
            cfgLine(t, 'tool.query', value.query),
            h('div', { className: 'fft_kvs' }, kvRow(t, 'tool.size', value.size), kvRow(t, 'tool.page', value.page), kvRow(t, 'tool.fields', value.fields)),
          ),
        ];
        if (shown.length === 0) {
          nodes.push(h('div', { className: 'fft_hint' }, t('tool.noRows')));
          return nodes;
        }
        nodes.push(
          h(
            'div',
            { className: 'fft_table' },
            h('div', { className: 'fft_tr fft_th' }, ...columns.map((column) => h('span', { className: 'fft_td' }, column))),
            ...shown.map((row) =>
              h(
                'div',
                { className: 'fft_tr' },
                ...columns.map((column) =>
                  h('span', { className: 'fft_td' }, clip(row === null || row === undefined ? '' : row[column], 64)),
                ),
              ),
            ),
          ),
        );
        if (rowCount > shown.length) {
          nodes.push(h('div', { className: 'fft_hint' }, `${t('tool.more')} ${rowCount - shown.length} ${t('tool.rows')}`));
        }
        return nodes;
      }
      const path = typeof value.path === 'string' ? value.path : '';
      const openPath = () => {
        if (path === '' || typeof openFile !== 'function') return;
        try {
          openFile(path);
        } catch {
          // Opening is best effort: a stale path must never break the row.
        }
      };
      const argsObject = args !== null && typeof args === 'object' ? args : {};
      const nodes = [
        h(
          'div',
          { className: 'fft_cfg' },
          cfgLine(t, 'tool.query', typeof value.query === 'string' && value.query !== '' ? value.query : argsObject.query),
          h(
            'div',
            { className: 'fft_kvs' },
            kvRow(t, 'tool.limit', requestedRows(t, argsObject)),
            kvRow(t, 'tool.fields', value.fields),
            kvRow(t, 'tool.format', value.format),
            kvRow(t, 'tool.dedup', value.dedup === '' ? '—' : value.dedup),
            ...(Number.isFinite(argsObject.fill) && argsObject.fill !== 1 ? [kvRow(t, 'tool.fill', argsObject.fill)] : []),
            ...(argsObject.full === true ? [kvRow(t, 'tool.full', t('tool.yes'))] : []),
          ),
        ),
        h(
          'div',
          { className: 'fft_kv' },
          h('span', { className: 'fft_k' }, t('tool.file')),
          path === ''
            ? h('span', { className: 'fft_v' }, '—')
            : h('button', { type: 'button', className: 'fft_v fft_link fft_mono', title: path, onClick: openPath }, path),
        ),
        h(
          'div',
          { className: 'fft_kvs' },
          kvRow(t, 'tool.written', Number.isInteger(value.written) ? `${value.written} ${t('tool.rows')}` : value.written),
          kvRow(t, 'tool.total', value.total),
          kvRow(t, 'tool.calls', value.apiCalls),
          kvRow(t, 'tool.duration', Number.isInteger(value.durationMs) ? `${value.durationMs} ms` : value.durationMs),
          kvRow(t, 'tool.status', reasonLabel(t, value.stoppedReason)),
          kvRow(t, 'tool.cursor', value.nextBefore),
        ),
      ];
      if (value.partial === true) nodes.push(h('div', { className: 'fft_hint fft_warn' }, t('tool.retryHint')));
      return nodes;
    }

    /** One FOFA tool call rendered as a compact, expandable conversation card. */
    function FofaToolRow(props) {
      const bound = props === null || props === undefined ? undefined : props.t;
      const t = React.useMemo(() => makeTranslator(bound), [bound]);
      // Collapsed by default: the head summarizes the call, the body is one click away.
      const [open, setOpen] = React.useState(false);
      const block = props === null || props === undefined ? undefined : props.block;
      const phase = props === null || props === undefined ? undefined : props.phase;
      const toolName = props === null || props === undefined || typeof props.toolName !== 'string' ? '' : props.toolName;
      const pending = phase !== 'result';
      const failed = !pending && block !== null && block !== undefined && block.isError === true;
      const args = React.useMemo(() => blockArgs(block), [block]);
      const meta = React.useMemo(() => (pending || failed ? null : blockMeta(block)), [block, pending, failed]);
      const value = React.useMemo(() => (pending || failed ? null : blockValue(block)), [block, pending, failed]);
      const model = meta !== null ? meta : value;
      const spilled = !pending && !failed && meta !== null && value === null && contentSpilled(block);
      const summary = React.useMemo(() => {
        if (pending) return args !== null && typeof args.query === 'string' && args.query !== '' ? clip(args.query, 72) : t('tool.preparing');
        if (failed) return clip(blockError(block), 120);
        if (model === null) return clip(blockText(block), 140);
        return toolSummary(t, toolName, model);
      }, [pending, failed, args, model, t, toolName, block]);
      const tone = pending ? 'muted' : failed ? 'error' : 'ok';
      let body;
      if (open) {
        if (failed) body = h('div', { className: 'fft_hint fft_warn' }, clip(blockError(block), 1600));
        else if (pending) {
          const argsObject = args !== null && typeof args === 'object' ? args : {};
          const rowsKey = toolName === 'fofa_export' ? 'tool.limit' : 'tool.size';
          const rowsValue = toolName === 'fofa_export' ? argsObject.limit : argsObject.size;
          const pendingRows = [];
          if (rowsValue !== undefined) pendingRows.push(kvRow(t, rowsKey, rowsValue));
          if (typeof argsObject.fields === 'string' && argsObject.fields !== '') {
            pendingRows.push(kvRow(t, 'tool.fields', argsObject.fields));
          }
          body = h(
            'div',
            { className: 'fft_cfg' },
            cfgLine(
              t,
              'tool.query',
              typeof argsObject.query === 'string' && argsObject.query !== '' ? argsObject.query : t('tool.preparing'),
            ),
            pendingRows.length === 0 ? null : h('div', { className: 'fft_kvs' }, ...pendingRows),
          );
        } else if (model !== null) {
          const bodyNodes = toolBody(t, toolName, model, args, props === null || props === undefined ? undefined : props.openFile);
          if (spilled) bodyNodes.push(h('div', { className: 'fft_hint fft_warn' }, t('tool.spilled')));
          body = h('div', { className: 'fft_toolBodyInner' }, ...bodyNodes);
        } else body = h('div', { className: 'fft_hint' }, clip(blockText(block), 1600));
      }
      return h(
        'div',
        { className: 'fft_tool', 'data-state': tone },
        h(
          'button',
          { type: 'button', className: 'fft_toolHead', 'aria-expanded': open, onClick: () => setOpen((current) => !current) },
          h('span', { className: 'fft_chev' }, open ? '▾' : '▸'),
          h('span', { className: 'fft_toolTitle' }, toolTitle(t, toolName)),
          h('span', { className: 'fft_toolSummary' }, summary),
          h('span', { className: 'fft_chip', 'data-tone': tone }, pending ? t('tool.running') : failed ? t('tool.failed') : t('tool.done')),
        ),
        body === undefined ? null : h('div', { className: 'fft_toolBody' }, body),
      );
    }


    /** Read one JSON response, rejecting non-2xx and `ok: false` payloads. */
    async function readJson(response) {
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : `HTTP ${response.status}`);
      return payload;
    }

    /** One async operation with its own busy/notice state, safe after unmount. */
    function useSettingsCard() {
      const [phase, setPhase] = React.useState('loading');
      const [status, setStatus] = React.useState(null);
      const [busy, setBusy] = React.useState('');
      const [notice, setNotice] = React.useState(null);
      const mounted = React.useRef(true);

      const applyStatus = React.useCallback((next) => {
        if (!mounted.current) return;
        setStatus(next);
        setPhase('ready');
      }, []);

      const load = React.useCallback(async () => {
        try {
          const response = await fetch(ROUTE_SETTINGS, {
            cache: 'no-store',
            headers: { accept: 'application/json', 'x-dsh-fofatoto-plugin': '1' },
          });
          const payload = await readJson(response);
          applyStatus(payload);
        } catch {
          if (!mounted.current) return;
          setPhase('error');
        }
      }, [applyStatus]);

      React.useEffect(() => {
        mounted.current = true;
        void load();
        return () => {
          mounted.current = false;
        };
      }, [load]);

      /** Run one card action, keeping a single busy flag and one result notice. */
      const run = React.useCallback(
        async (kind, request, describe) => {
          if (!mounted.current) return;
          setBusy(kind);
          setNotice(null);
          try {
            const result = await request();
            if (!mounted.current) return;
            setNotice(describe(result));
            if (result?.ok !== false && typeof result?.configured === 'boolean') applyStatus(result);
          } catch (error) {
            if (!mounted.current) return;
            setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
          } finally {
            if (mounted.current) setBusy('');
          }
        },
        [applyStatus],
      );

      return { phase, status, busy, notice, setNotice, run };
    }

    /** One compact status chip describing where the key comes from. */
    function StatusChip({ t, status }) {
      if (status === null || status === undefined) return h('span', { className: 'fft_chip', 'data-tone': 'muted' }, t('status.loading'));
      if (status.configured !== true) return h('span', { className: 'fft_chip', 'data-tone': 'muted' }, t('status.missing'));
      const source = t(`source.${status.source ?? 'none'}`);
      const hint = typeof status.hint === 'string' && status.hint !== '' ? ` ${status.hint}` : '';
      return h('span', { className: 'fft_chip', 'data-tone': 'ok' }, `${t('status.configured')} · ${source}${hint}`);
    }

    /** The configuration card rendered in the bundle's page on the Plugins page. */
    function FofatotoConfigCard(props) {
      const t = React.useMemo(() => makeTranslator(props?.t), [props?.t]);
      const { phase, status, busy, notice, setNotice, run } = useSettingsCard();
      const [draft, setDraft] = React.useState('');
      const [baseDraft, setBaseDraft] = React.useState('');
      const [quotaText, setQuotaText] = React.useState('');
      const ready = phase === 'ready' && status !== null;
      const configured = ready && status.configured === true;
      /** Only an explicit `false` pins the base URL; older Hosts omit the flag. */
      const editable = ready && status.editable !== false;
      const draftKey = draft.trim();
      const baseKey = baseDraft.trim();
      const baseUrlValid = isValidBaseUrl(baseKey);
      const savedBaseUrl = ready ? asText(status.baseUrl) : '';
      const baseChanged = baseKey !== savedBaseUrl;
      const dirty = draftKey !== '' || baseChanged;

      React.useEffect(() => {
        if (phase === 'error') setNotice({ tone: 'error', text: t('loadFailed') });
        else if (phase === 'ready') setNotice(null);
      }, [phase, setNotice, t]);

      // Prefill (and re-sync after save/clear) the base URL draft from the Host.
      React.useEffect(() => {
        if (status === null || typeof status !== 'object') return;
        setBaseDraft(typeof status.baseUrl === 'string' ? status.baseUrl : '');
      }, [status]);

      const save = React.useCallback(() => {
        if (busy !== '') return;
        const hasKey = draftKey !== '';
        // Endpoint edits need the Host config editor; a key-only save does not.
        if (!editable && !hasKey) {
          setNotice({ tone: 'error', text: t('endpointNotEditable') });
          return;
        }
        if (editable && !baseUrlValid) {
          setNotice({ tone: 'error', text: t('invalidBaseUrl') });
          return;
        }
        if (!dirty) return;
        setQuotaText('');
        const apiKey = draftKey;
        void run(
          'save',
          async () => {
            const body = {};
            if (editable) body.baseUrl = baseKey;
            if (apiKey !== '') body.apiKey = apiKey;
            const response = await fetch(ROUTE_SETTINGS, {
              method: 'POST',
              cache: 'no-store',
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'x-dsh-fofatoto-plugin': '1',
              },
              body: JSON.stringify(body),
            });
            const payload = await readJson(response);
            if (payload.ok === false) throw new Error(payload.error ?? 'save failed');
            return payload;
          },
          (result) => {
            setDraft('');
            if (typeof result?.baseUrl === 'string') setBaseDraft(result.baseUrl);
            return {
              tone: 'ok',
              text: result?.reconfigApplied === false ? t('endpointSavedRestart') : t('saved'),
            };
          },
        );
      }, [busy, editable, baseUrlValid, dirty, draftKey, baseKey, run, setNotice, t]);

      const test = React.useCallback(() => {
        if (busy !== '') return;
        if (!baseUrlValid) {
          setNotice({ tone: 'error', text: t('invalidBaseUrl') });
          return;
        }
        setQuotaText('');
        const apiKey = draftKey;
        void run(
          'test',
          async () => {
            const body = { baseUrl: baseKey };
            if (apiKey !== '') body.apiKey = apiKey;
            const response = await fetch(ROUTE_TEST, {
              method: 'POST',
              cache: 'no-store',
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'x-dsh-fofatoto-plugin': '1',
              },
              body: JSON.stringify(body),
            });
            const payload = await readJson(response);
            if (payload.ok !== true) {
              const detail = typeof payload.msg === 'string' && payload.msg !== '' ? payload.msg : t('testFailed');
              const code = payload.apiCode === null || payload.apiCode === undefined ? '' : ` · code ${payload.apiCode}`;
              throw new Error(`${detail}${code}`);
            }
            return payload;
          },
          (result) => {
            setQuotaText(formatQuota(result.quota, t));
            return {
              tone: 'ok',
              text: `${t('testOk')} · HTTP ${result.httpStatus} · ${result.latencyMs}ms`,
            };
          },
        );
      }, [busy, baseUrlValid, draftKey, baseKey, run, setNotice, t]);

      const clear = React.useCallback(() => {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(t('confirmClear'))) return;
        setQuotaText('');
        void run(
          'clear',
          async () => {
            const response = await fetch(ROUTE_SETTINGS, {
              method: 'POST',
              cache: 'no-store',
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'x-dsh-fofatoto-plugin': '1',
              },
              body: JSON.stringify({ clear: true }),
            });
            const payload = await readJson(response);
            if (payload.ok === false) throw new Error(payload.error ?? 'clear failed');
            return payload;
          },
          () => ({ tone: 'ok', text: t('cleared') }),
        );
      }, [run, t]);

      if (props?.view === 'summary') {
        return h('span', { className: 'fft_summary' }, h(StatusChip, { t, status: ready ? status : null }));
      }

      const canSave = busy === '' && (draftKey !== ''
        ? !editable || baseUrlValid
        : editable && dirty && baseUrlValid);
      const canTest = busy === '' && (draftKey !== '' || configured);
      const canClear = configured && status?.source === 'credential' && busy === '';

      return h(
        'div',
        { className: 'fft_card' },
        h(
          'div',
          { className: 'fft_header' },
          h('span', { className: 'fft_title' }, t('title')),
          h(StatusChip, { t, status: ready ? status : null }),
        ),
        h(
          'label',
          { className: 'fft_field' },
          h('span', { className: 'fft_fieldLabel' }, t('keyLabel')),
          h('input', {
            className: 'fft_input',
            type: 'password',
            value: draft,
            autoComplete: 'off',
            spellCheck: false,
            placeholder: t('keyPlaceholder'),
            disabled: busy !== '' || phase !== 'ready',
            onChange: (event) => {
              setDraft(event.target.value);
              if (notice !== null && notice.tone === 'error') setNotice(null);
            },
            onKeyDown: (event) => {
              if (event.key === 'Enter' && canSave) save();
            },
          }),
        ),
        h(
          'div',
          { className: 'fft_endpoints' },
          h(
            'label',
            { className: 'fft_field' },
            h('span', { className: 'fft_fieldLabel' }, t('baseUrlLabel')),
            h('input', {
              className: 'fft_input',
              type: 'text',
              inputMode: 'url',
              value: baseDraft,
              autoComplete: 'off',
              spellCheck: false,
              placeholder: t('baseUrlPlaceholder'),
              disabled: busy !== '' || phase !== 'ready' || !editable,
              onChange: (event) => {
                setBaseDraft(event.target.value);
                if (notice !== null && notice.tone === 'error') setNotice(null);
              },
              onBlur: () => {
                const value = baseDraft.trim();
                if (value !== '' && !isValidBaseUrl(value)) setNotice({ tone: 'error', text: t('invalidBaseUrl') });
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter' && canSave) save();
              },
            }),
          ),
          ready && !editable ? h('p', { className: 'fft_hint' }, t('endpointNotEditable')) : null,
        ),
        h(
          'div',
          { className: 'fft_actions' },
          h(
            'button',
            { type: 'button', className: 'fft_button fft_primary', disabled: !canSave, onClick: save },
            busy === 'save' ? t('saving') : t('save'),
          ),
          h(
            'button',
            { type: 'button', className: 'fft_button', disabled: !canTest, onClick: test },
            busy === 'test' ? t('testing') : t('test'),
          ),
          canClear
            ? h(
                'button',
                { type: 'button', className: 'fft_button fft_danger', disabled: busy !== '', onClick: clear },
                busy === 'clear' ? t('clearing') : t('clear'),
              )
            : null,
        ),
        notice !== null ? h('div', { className: 'fft_notice', 'data-tone': notice.tone }, notice.text) : null,
        quotaText !== '' ? h('p', { className: 'fft_quota' }, quotaText) : null,
        h('p', { className: 'fft_hint' }, t('hintStorage')),
        h('p', { className: 'fft_hint' }, t('hintGenerate')),
        h('p', { className: 'fft_meta' }, `${t('endpoint')}: ${ready ? savedBaseUrl || '—' : '—'}`),
      );
    }

    const CSS = `
.fft_summary{color:var(--dsw-alias-label-secondary);font-size:inherit}
.fft_card{gap:8px;display:grid;max-width:100%}
.fft_header{align-items:center;justify-content:space-between;gap:12px;display:flex;flex-wrap:wrap}
.fft_title{color:var(--dsw-alias-label-primary);font-weight:500;font-size:13px;line-height:20px}
.fft_chip{box-sizing:border-box;border-radius:999px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-interactive-bg-hover);white-space:nowrap;font-size:11px;line-height:18px;padding:1px 8px;border:none}
.fft_chip[data-tone=ok]{color:var(--dsw-alias-state-success-primary)}
.fft_field{gap:6px;display:grid}
.fft_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.fft_input{box-sizing:border-box;width:100%;border-radius:var(--dsw-radius-sm);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-primary);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:6px 10px}
.fft_input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.fft_input::placeholder{color:var(--dsw-alias-label-tertiary)}
.fft_input:disabled{opacity:.6}
.fft_endpoints{gap:8px;display:grid;margin-top:2px}
.fft_actions{align-items:center;gap:8px;display:flex;flex-wrap:wrap;margin-top:2px}
.fft_button{box-sizing:border-box;border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);border:none;cursor:pointer;font:inherit;font-size:12px;line-height:18px;padding:4px 12px}
.fft_button:hover:enabled{color:var(--dsw-alias-label-primary)}
.fft_button:disabled{cursor:default;opacity:.5}
.fft_primary{color:var(--dsw-alias-label-primary);font-weight:500}
.fft_danger{color:var(--dsw-alias-state-error-primary)}
.fft_notice{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-word}
.fft_notice[data-tone=ok]{color:var(--dsw-alias-state-success-primary)}
.fft_notice[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.fft_quota{color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:18px;word-break:break-word}
.fft_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:11px;line-height:1.6}
.fft_meta{color:var(--dsw-alias-label-tertiary);margin:0;font-size:11px;line-height:1.6;word-break:break-all}
.fft_tool{box-sizing:border-box;width:100%;max-width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);overflow:hidden;margin:2px 0}
.fft_tool[data-state=error]{border-color:var(--dsw-alias-state-error-primary)}
.fft_toolHead{align-items:center;gap:8px;width:100%;box-sizing:border-box;border:none;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;display:flex;padding:6px 10px}
.fft_toolHead:hover{background:var(--dsw-alias-interactive-bg-hover)}
.fft_chev{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1;flex:none}
.fft_toolTitle{color:var(--dsw-alias-label-primary);font-weight:500;font-size:13px;line-height:20px;flex:none}
.fft_toolSummary{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.fft_toolBody{border-top:1px solid var(--dsw-alias-border-l2);padding:8px 10px 10px}
.fft_toolBodyInner{gap:8px;display:grid}
.fft_chip[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.fft_chip[data-tone=muted]{color:var(--dsw-alias-label-tertiary)}
.fft_kvs{display:grid;gap:2px 12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.fft_cfg{display:grid;gap:4px}
.fft_cfgLine{align-items:baseline;gap:6px;display:flex;min-width:0;font-size:12px;line-height:18px}
.fft_kv{display:flex;gap:6px;font-size:12px;line-height:18px;min-width:0}
.fft_k{color:var(--dsw-alias-label-tertiary);flex:none}
.fft_v{color:var(--dsw-alias-label-primary);min-width:0;overflow-wrap:anywhere}
.fft_mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}
.fft_link{background:none;border:none;padding:0;color:var(--dsw-alias-brand-primary);cursor:pointer;text-align:left;font:inherit;overflow-wrap:anywhere}
.fft_table{display:grid;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);overflow:hidden}
.fft_tr{display:grid;grid-template-columns:1.4fr 1fr .5fr 1.6fr;gap:8px;padding:4px 8px;font-size:11px;line-height:16px;border-top:1px solid var(--dsw-alias-border-l2)}
.fft_tr:first-child{border-top:none}
.fft_th{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary)}
.fft_td{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fft_warn{color:var(--dsw-alias-state-error-primary)}
`;

    /** Register the card and own its dictionary and stylesheet. */
    function apply(ctx) {
      let translate = fallbackTranslate;
      if (typeof ctx.locale?.bind === 'function') {
        try {
          translate = ctx.locale.bind(NS);
        } catch {
          translate = fallbackTranslate;
        }
      }
      if (typeof ctx.locale?.register === 'function') {
        ctx.effect(() => ctx.locale.register(NS, { en: DICT.en, zh: DICT.zh }), 'fofatoto: dictionaries');
      }
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-fofatoto';
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => {
          tag.remove();
        };
      }, 'fofatoto: stylesheet');
      ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.bundle.config',
            key: 'dsh-fofatoto',
            locale: NS,
            label: () => translate('keyLabel'),
          },
          FofatotoConfigCard,
        ),
      );
      // Conversation cards: one keyed occupant per wire tool name. The built-in
      // Web Client does not consume host-side presenters, so this is where a
      // tool result gets its own layout instead of the generic row.
      for (const toolName of ['fofa_account', 'fofa_search', 'fofa_export']) {
        ctx.slots.inject('tool.call.toolview', () =>
          ctx.slots.register({ name: 'tool.call.toolview', key: toolName, locale: NS }, FofaToolRow),
        );
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    };
  },
});
