/** DSH client for the FOFA settings and conversation cards. */
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
    const PROJECT_URL = 'https://github.com/keyblues/fofatoto';

    const DICT = {
      en: {
        'status.loading': 'Loading…',
        'status.error': 'Settings unavailable',
        'status.configured': 'Configured',
        'status.missing': 'API key required',
        'source.credential': 'Harness credentials',
        'source.config': 'plugin config',
        'source.env': 'environment variable',
        'source.file': 'fofatoto config',
        'source.none': 'none',
        keyLabel: 'API key',
        keyPlaceholder: 'Paste your API key',
        baseUrlLabel: 'API URL',
        endpointNotEditable: 'Edit the API URL in cordis.patch.yml.',
        invalidBaseUrl: 'Enter a full HTTP or HTTPS URL.',
        endpointSavedRestart: 'Saved. Restart Harness to apply.',
        save: 'Save',
        saving: 'Saving…',
        test: 'Test connection',
        testing: 'Testing…',
        clear: 'Remove key',
        clearing: 'Removing…',
        confirmClear: 'Remove the saved API key?',
        saved: 'Saved.',
        cleared: 'API key removed.',
        testOk: 'Connection OK',
        reloadHint: 'Reload the page to try again.',
        hintStorage: 'Saved to Harness credentials. Only the key suffix is shown.',
        hintGenerate: 'Find your API key in your FOFA account.',
        project: 'fofatoto project',
        'tool.account': 'FOFA account',
        'tool.search': 'FOFA search',
        'tool.export': 'FOFA export',
        'tool.preparing': 'Preparing…',
        'tool.running': 'running',
        'tool.failed': 'failed',
        'tool.query': 'query',
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
        'tool.total': 'total matches',
        'tool.calls': 'API calls',
        'tool.duration': 'duration',
        'tool.dedup': 'dedup by',
        'tool.cursor': 'cursor',
        'tool.more': '…and',
        'tool.noRows': 'No rows on this page.',
        'tool.uniqueIps': 'unique IPs',
        'tool.output': 'Output',
        'tool.errorOutput': 'Error',
        'tool.validBadge': 'valid',
        'tool.invalidBadge': 'invalid',
        'tool.yes': 'yes',
        'tool.today': 'today left',
        'tool.remain': 'queries left',
        'tool.expiration': 'expires',
        'tool.firstUsed': 'first used',
        'tool.vipLevel': 'VIP level',
        'tool.server': 'server',
        'tool.format': 'format',
        'tool.written': 'written',
        'tool.status': 'state',
        'tool.partial': 'partial',
        'tool.spilled': 'Full results saved to disk.',
        'tool.retryHint': 'Use appendTo to resume.',
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
        'status.loading': '读取中…',
        'status.error': '配置加载失败',
        'status.configured': '已配置',
        'status.missing': '未配置 API Key',
        'source.credential': 'Harness 凭据库',
        'source.config': '插件配置',
        'source.env': '环境变量',
        'source.file': 'fofatoto 配置',
        'source.none': '无',
        keyLabel: 'API Key',
        keyPlaceholder: '粘贴 API Key',
        baseUrlLabel: '接口地址',
        endpointNotEditable: '请在 cordis.patch.yml 中修改接口地址。',
        invalidBaseUrl: '请输入完整的 HTTP 或 HTTPS 地址。',
        endpointSavedRestart: '已保存，重启 Harness 后生效。',
        save: '保存',
        saving: '保存中…',
        test: '测试连接',
        testing: '测试中…',
        clear: '清除 Key',
        clearing: '清除中…',
        confirmClear: '清除已保存的 API Key？',
        saved: '已保存。',
        cleared: 'API Key 已清除。',
        testOk: '连接正常',
        reloadHint: '请刷新页面重试。',
        hintStorage: 'Key 存入 Harness 凭据库，页面仅显示尾号。',
        hintGenerate: '在 FOFA 个人中心获取 API Key。',
        project: 'fofatoto 源码',
        'tool.account': 'FOFA 账号',
        'tool.search': 'FOFA 检索',
        'tool.export': 'FOFA 导出',
        'tool.preparing': '准备中…',
        'tool.running': '执行中',
        'tool.failed': '失败',
        'tool.query': '语句',
        'tool.size': '条数',
        'tool.page': '页码',
        'tool.fields': '字段',
        'tool.limit': '条数上限',
        'tool.all': '全部（有上限）',
        'tool.defaultLimit': '默认 1000',
        'tool.fill': '比例',
        'tool.full': '含历史数据',
        'tool.rows': '行',
        'tool.hit': '命中',
        'tool.hitUnit': '条',
        'tool.total': '总匹配',
        'tool.calls': '接口调用',
        'tool.duration': '耗时',
        'tool.dedup': '去重字段',
        'tool.cursor': '游标',
        'tool.more': '…另有',
        'tool.noRows': '本页没有结果。',
        'tool.uniqueIps': '去重 IP',
        'tool.output': '输出',
        'tool.errorOutput': '错误',
        'tool.validBadge': '有效',
        'tool.invalidBadge': '无效',
        'tool.yes': '有效',
        'tool.today': '今日剩余',
        'tool.remain': '剩余查询',
        'tool.expiration': '到期',
        'tool.firstUsed': '首次使用',
        'tool.vipLevel': 'VIP 等级',
        'tool.server': 'fofa_server',
        'tool.format': '格式',
        'tool.written': '已写入',
        'tool.status': '停止原因',
        'tool.partial': '部分完成',
        'tool.spilled': '完整结果已落盘。',
        'tool.retryHint': '用 appendTo 继续导出。',
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

    function formatQuota(quota, t) {
      if (quota === null || typeof quota !== 'object') return '';
      const type = quota.type === 'relay' || quota.type === 'standard' ? t(`tool.${quota.type}`) : '';
      const fields = [
        ['tool.today', quota.todayRemaining],
        ['tool.remain', quota.remainApiQuery],
        ['tool.expiration', quota.expiration],
      ];
      const parts = fields
        .filter(([, value]) => hasValue(value))
        .map(([label, value]) => `${t(label)} ${String(value).trim()}`);
      return [type, ...parts].filter(Boolean).join(' · ');
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
      const raw = typeof block.kind === 'string' ? block.call?.argsRaw : block.argsRaw;
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

    /** Official 16x16 outline glyph; the shipped rows use a 1px regular stroke. */
    function outlineIcon(nodes, size, className, key) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          xmlns: 'http://www.w3.org/2000/svg',
          'aria-hidden': 'true',
          strokeWidth: 1,
          className,
          key,
        },
        ...nodes,
      );
    }

    /** One stroked outline path of an official glyph. */
    function outlinePath(d, extra) {
      return h('path', { d, stroke: 'currentColor', ...(extra === undefined ? {} : extra) });
    }

    /** Glyph of one FOFA wire tool: globe (account), magnifier (search), download (export). */
    function toolIcon(toolName) {
      if (toolName === 'fofa_search') {
        return outlineIcon(
          [
            outlinePath(
              'M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z',
            ),
            outlinePath('M10.2991 10.3933L14.7783 14.8725'),
          ],
          14,
        );
      }
      if (toolName === 'fofa_export') {
        return outlineIcon(
          [
            outlinePath('M8 1.95317V10.0469'),
            outlinePath('M4.25 6.29688L8 10.0469L11.75 6.29688'),
            outlinePath(
              'M1.5 10.0469V13.158C1.5 13.3937 1.60536 13.6198 1.79289 13.7865C1.98043 13.9532 2.23478 14.0469 2.5 14.0469H13.5C13.7652 14.0469 14.0196 13.9532 14.2071 13.7865C14.3946 13.6198 14.5 13.3937 14.5 13.158V10.0469',
            ),
          ],
          14,
        );
      }
      return outlineIcon(
        [
          outlinePath(
            'M7.99986 14.0887C11.3626 14.0887 14.0886 11.3627 14.0886 7.99998C14.0886 4.63727 11.3626 1.91125 7.99986 1.91125C4.63715 1.91125 1.91113 4.63727 1.91113 7.99998C1.91113 11.3627 4.63715 14.0887 7.99986 14.0887Z',
          ),
          outlinePath('M2.34619 8H13.6538', { strokeLinecap: 'square' }),
          outlinePath(
            'M7.99976 14.0889C9.23509 14.0889 10.1743 11.3629 10.1743 8.00006C10.1743 4.63739 9.23509 1.91138 7.99976 1.91138',
          ),
          outlinePath(
            'M7.99973 14.0889C6.76445 14.0889 5.8252 11.3629 5.8252 8.00006C5.8252 4.63739 6.76445 1.91138 7.99973 1.91138',
          ),
        ],
        14,
      );
    }

    /** Disclosure chevron; `open` points it up like the shipped rows. */
    function chevronIcon(open, className, key) {
      return outlineIcon(
        [
          open
            ? outlinePath('M12 10L8.70711 6.70711C8.31658 6.31658 7.68342 6.31658 7.29289 6.70711L4 10')
            : outlinePath('M4 6L7.29289 9.29289C7.68342 9.68342 8.31658 9.68342 8.70711 9.29289L12 6'),
        ],
        14,
        className,
        key,
      );
    }

    /** Printable cell: never `undefined`/`null`/empty, which would collapse a row. */
    function cellValue(value) {
      if (value === null || value === undefined) return '—';
      const text = String(value).trim();
      return text === '' ? '—' : text;
    }

    /** One text run of the collapsed head; `masked` renders it for the shimmer sweep. */
    function headText(masked, className, value, key) {
      const shared = `fft_shimmerText ${className}`;
      return masked
        ? h('span', { key, className: shared, 'data-shimmer-text': value })
        : h('span', { key, className: shared }, value);
    }

    /**
     * Running-state sweep copied from the shipped tool row: the base content and
     * an identical masked clone animate over each other. `render(masked)` must
     * return the same node tree both times.
     */
    function shimmerLine(props) {
      const active = props.active === true;
      return h(
        'span',
        { className: 'fft_shimmer', 'data-shimmer': active ? '' : undefined },
        h('span', { className: 'fft_shimmerContent' }, props.render(false)),
        active
          ? h(
              'span',
              { className: 'fft_shimmerDecoration', 'aria-hidden': 'true', inert: '' },
              h(
                'span',
                { className: 'fft_shimmerSweep' },
                h('span', { className: 'fft_shimmerContent fft_shimmerHighlight' }, props.render(true)),
              ),
            )
          : null,
      );
    }

    /** One `dt`/`dd` block of a details card (rows without a value are skipped). */
    function fieldList(fields) {
      const rows = fields
        .filter((field) => field !== null && field !== undefined)
        .map((field, index) =>
          h(
            'div',
            { key: index, className: 'fft_detailsField' },
            h('dt', null, field.label),
            h('dd', null, field.mono === true && typeof field.value === 'string'
              ? h('span', { className: 'fft_mono' }, field.value)
              : field.value === null || field.value === undefined
                ? '—'
                : field.value),
          ),
        );
      return rows.length === 0 ? null : h('dl', { className: 'fft_detailsFields' }, ...rows);
    }

    /** Heading line of a details item: text, or an openable path, plus an optional badge. */
    function detailHeading(text, options) {
      const settings = options === undefined ? {} : options;
      const inner = settings.mono === true && typeof text === 'string' ? h('span', { className: 'fft_mono' }, text) : text;
      const title = typeof settings.action === 'function'
        ? h('button', { type: 'button', className: 'fft_detailsPath', title: settings.title, onClick: settings.action }, inner)
        : h('span', { className: 'fft_detailsText' }, inner);
      return h(
        'div',
        { className: 'fft_detailsHeading' },
        title,
        settings.badge === undefined
          ? null
          : h('span', { className: 'fft_detailsBadge', 'data-tone': settings.badge.tone }, settings.badge.label),
      );
    }

    /** Secondary line of a details item. */
    function detailSubtitle(text) {
      return h('div', { className: 'fft_detailsSubtitle' }, text);
    }

    /** Caption line of a details item (trailing hints, spilled notices). */
    function detailDescription(text) {
      return h('div', { className: 'fft_detailsDescription' }, text);
    }

    /** One bordered details card: a list of items built from heading/fields/notes. */
    function detailsCard(items) {
      const rows = items.filter((nodes) => nodes.filter((node) => node !== null && node !== undefined).length > 0);
      if (rows.length === 0) return null;
      return h(
        'div',
        { className: 'fft_detailsCard' },
        h(
          'ul',
          { className: 'fft_detailsList' },
          ...rows.map((nodes, index) =>
            h('li', { key: index, className: 'fft_detailsItem' }, ...nodes.filter((node) => node !== null && node !== undefined)),
          ),
        ),
      );
    }

    /** Shipped Input/Output panel: raw text for failures and unparsable results. */
    function ioCard(label, text, isError) {
      return h(
        'div',
        { className: 'fft_ioCard' },
        h(
          'div',
          { className: 'fft_ioSection' },
          h('span', { className: 'fft_ioLabel' }, label),
          h('span', { className: 'fft_ioText', 'data-error': isError ? 'true' : undefined }, text),
        ),
      );
    }

    /** One trailing notice under a card (partial export, spilled preview). */
    function cardNote(text, tone) {
      return h('div', { className: 'fft_note', 'data-tone': tone }, text);
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

    /**
     * Collapsed-head text of one settled tool value: `summary` is what the call
     * acted on and `suffix` is its one-line stat — the shipped row's
     * `summary` + `summarySuffix` pair, so the head stays to two facts.
     */
    function toolHead(t, toolName, value) {
      if (toolName === 'fofa_account') {
        const account = value.account !== null && typeof value.account === 'object' ? value.account : {};
        const type = account.type === 'relay' ? t('tool.relay') : account.type === 'standard' ? t('tool.standard') : '';
        return {
          summary: type,
          suffix: hasValue(account.todayRemaining) ? `${t('tool.today')} ${account.todayRemaining}` : '',
        };
      }
      if (toolName === 'fofa_search') {
        const query = typeof value.query === 'string' ? value.query : '';
        // The Host schema forbids a non-numeric total, but legacy or hand-made
        // session events can still carry null/NaN; never print that into the head.
        const total = hasValue(value.total) ? value.total : 0;
        return {
          summary: query === '' ? '' : clip(query, 72),
          suffix: [t('tool.hit'), String(total), t('tool.hitUnit')].filter((part) => part !== '').join(' '),
        };
      }
      const written = Number.isInteger(value.written) ? `${value.written} ${t('tool.rows')}` : '';
      const query = typeof value.query === 'string' ? value.query : '';
      return {
        summary: query !== '' ? clip(query, 72) : typeof value.path === 'string' ? clip(value.path, 72) : '',
        suffix: [written, value.partial === true ? t('tool.partial') : ''].filter((part) => part !== '').join(' · '),
      };
    }

    /** Preview rows of one search page rendered inside the card. */
    const PREVIEW_ROWS = 8;

    /** Body of one settled `fofa_account` call. */
    function accountBody(t, value) {
      const account = value.account !== null && typeof value.account === 'object' ? value.account : {};
      const type = account.type === 'relay' ? t('tool.relay') : account.type === 'standard' ? t('tool.standard') : cellValue(account.type);
      const valid = account.valid === true;
      const meta = [
        hasValue(value.httpStatus) ? `HTTP ${value.httpStatus}` : '',
        typeof value.source === 'string' ? t(`source.${value.source}`) : '',
        hasValue(account.baseUrl) ? String(account.baseUrl) : '',
      ]
        .filter((part) => part !== '')
        .join(' · ');
      return [
        detailsCard([
          [
            detailHeading(type, {
              badge: { tone: valid ? 'success' : 'error', label: valid ? t('tool.validBadge') : t('tool.invalidBadge') },
            }),
            meta === '' ? null : detailSubtitle(meta),
            fieldList([
              { label: t('tool.today'), value: account.todayRemaining },
              { label: t('tool.remain'), value: account.remainApiQuery },
              { label: t('tool.expiration'), value: account.expiration },
              { label: t('tool.firstUsed'), value: account.firstUsed },
              { label: t('tool.vipLevel'), value: account.vipLevel },
              { label: t('tool.server'), value: account.server, mono: true },
            ]),
          ],
        ]),
      ];
    }

    /** Body of one settled `fofa_search` call: request fields and preview rows. */
    function searchBody(t, value) {
      const rows = Array.isArray(value.rows) ? value.rows : [];
      const shown = rows.slice(0, PREVIEW_ROWS);
      const rowCount = Number.isInteger(value.rowCount) ? value.rowCount : rows.length;
      const items = [
        [
          fieldList([
            { label: t('tool.query'), value: value.query, mono: true },
            { label: t('tool.size'), value: value.size },
            { label: t('tool.page'), value: value.page },
            { label: t('tool.fields'), value: value.fields },
            hasValue(value.uniqueIps) ? { label: t('tool.uniqueIps'), value: value.uniqueIps } : null,
          ]),
        ],
      ];
      for (const row of shown) {
        const target = row !== null && typeof row === 'object' ? row : {};
        const address = [hasValue(target.ip) ? String(target.ip) : '', hasValue(target.port) ? String(target.port) : '']
          .filter((part) => part !== '')
          .join(':');
        const title = cellValue(target.title);
        const detail = [address, title === '—' ? '' : title].filter((part) => part !== '').join(' · ');
        items.push([
          detailHeading(hasValue(target.host) ? String(target.host) : cellValue(target.ip), { mono: true }),
          detail === '' ? null : detailSubtitle(detail),
        ]);
      }
      if (shown.length === 0) items.push([detailDescription(t('tool.noRows'))]);
      if (rowCount > shown.length) {
        items.push([detailDescription(`${t('tool.more')} ${rowCount - shown.length} ${t('tool.rows')}`)]);
      }
      return [detailsCard(items)];
    }

    /** Body of one settled `fofa_export` call: request config, file, counters. */
    function exportBody(t, value, args, openFile) {
      const request = args !== null && typeof args === 'object' ? args : {};
      const path = typeof value.path === 'string' ? value.path : '';
      const openPath = () => {
        if (path === '' || typeof openFile !== 'function') return;
        try {
          openFile(path);
        } catch {
          // Opening is best effort: a stale path must never break the row.
        }
      };
      const fileItem = [
        detailHeading(path === '' ? '—' : path, {
          mono: true,
          title: path === '' ? undefined : path,
          action: path === '' ? undefined : openPath,
        }),
        fieldList([
          { label: t('tool.written'), value: Number.isInteger(value.written) ? `${value.written} ${t('tool.rows')}` : value.written },
          { label: t('tool.total'), value: value.total },
          { label: t('tool.calls'), value: value.apiCalls },
          { label: t('tool.duration'), value: Number.isInteger(value.durationMs) ? `${value.durationMs} ms` : value.durationMs },
          { label: t('tool.status'), value: reasonLabel(t, value.stoppedReason) },
          { label: t('tool.cursor'), value: value.nextBefore, mono: true },
        ]),
      ];
      const nodes = [
        detailsCard([
          [
            fieldList([
              {
                label: t('tool.query'),
                value: typeof value.query === 'string' && value.query !== '' ? value.query : request.query,
                mono: true,
              },
              { label: t('tool.limit'), value: requestedRows(t, request) },
              { label: t('tool.fields'), value: value.fields },
              { label: t('tool.format'), value: value.format },
              { label: t('tool.dedup'), value: value.dedup },
              Number.isFinite(request.fill) && request.fill !== 1 ? { label: t('tool.fill'), value: request.fill } : null,
              request.full === true ? { label: t('tool.full'), value: t('tool.yes') } : null,
            ]),
          ],
          fileItem,
        ]),
      ];
      if (value.partial === true && value.format !== 'json' && asText(value.nextBefore) !== '') {
        nodes.push(cardNote(t('tool.retryHint'), 'warn'));
      }
      return nodes;
    }

    /** Body of one running call: the request as far as it has arrived. */
    function pendingBody(t, toolName, args) {
      const request = args !== null && typeof args === 'object' ? args : {};
      const rowsKey = toolName === 'fofa_export' ? 'tool.limit' : 'tool.size';
      const rowsValue = toolName === 'fofa_export' ? request.limit : request.size;
      return [
        detailsCard([
          [
            fieldList([
              {
                label: t('tool.query'),
                value: typeof request.query === 'string' && request.query !== '' ? request.query : t('tool.preparing'),
                mono: true,
              },
              rowsValue === undefined ? null : { label: t(rowsKey), value: rowsValue },
              typeof request.fields === 'string' && request.fields !== '' ? { label: t('tool.fields'), value: request.fields } : null,
            ]),
          ],
        ]),
      ];
    }

    /**
     * One FOFA tool call rendered like a shipped Tool card: a disclosure head
     * (glyph, title, separator, summary) and an expandable details body.
     */
    function FofaToolRow(props) {
      const bound = props === null || props === undefined ? undefined : props.t;
      const t = React.useMemo(() => makeTranslator(bound), [bound]);
      const phase = props === null || props === undefined ? undefined : props.phase;
      const block = props === null || props === undefined ? undefined : props.block;
      const toolName = props === null || props === undefined || typeof props.toolName !== 'string' ? '' : props.toolName;
      const openFile = props === null || props === undefined ? undefined : props.openFile;
      const preparing = phase === 'preparing';
      const pending = phase !== 'result';
      const failed = !pending && block !== null && block !== undefined && block.isError === true;
      const args = React.useMemo(() => blockArgs(block), [block]);
      const meta = React.useMemo(() => (pending || failed ? null : blockMeta(block)), [block, pending, failed]);
      const value = React.useMemo(() => (pending || failed ? null : blockValue(block)), [block, pending, failed]);
      const model = meta !== null ? meta : value;
      const spilled = !pending && !failed && meta !== null && value === null && contentSpilled(block);
      const head = React.useMemo(() => {
        if (pending) {
          return {
            summary:
              args !== null && typeof args.query === 'string' && args.query !== ''
                ? clip(args.query, 72)
                : t(preparing ? 'tool.preparing' : 'tool.running'),
            suffix: '',
          };
        }
        if (failed) return { summary: clip(blockError(block), 120), suffix: '' };
        if (model === null) return { summary: clip(blockText(block), 140), suffix: '' };
        return toolHead(t, toolName, model);
      }, [pending, preparing, failed, args, model, t, toolName, block]);
      // One stable disclosure Hook per mounted call: the conversation owner's
      // Hook when it supplies one, local state otherwise. Choosing once keeps the
      // Hook order stable for the card's lifetime.
      function useLocalDisclosure() {
        const [expanded, setExpanded] = React.useState(false);
        return { expanded, toggle: () => setExpanded((current) => !current) };
      }
      const disclosureHook = React.useRef(null);
      if (disclosureHook.current === null) {
        const ownerHook = props !== null && props !== undefined && typeof props.useDisclosure === 'function' ? props.useDisclosure : null;
        disclosureHook.current = ownerHook === null ? useLocalDisclosure : ownerHook;
      }
      const disclosure = disclosureHook.current();
      const expandable = !preparing;
      const expanded = expandable && disclosure.expanded === true;
      const toggle = () => {
        if (typeof disclosure.toggle === 'function') disclosure.toggle();
      };
      const onRowKeyDown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      };
      const state = pending ? (preparing ? 'preparing' : 'running') : failed ? 'error' : 'ok';
      const statusText = pending ? t(preparing ? 'tool.preparing' : 'tool.running') : failed ? t('tool.failed') : null;
      const title = toolTitle(t, toolName);
      const summaryClass = failed ? 'fft_headSummary fft_errorSummary' : 'fft_headSummary';
      const renderHead = (masked) => {
        const nodes = [headText(masked, 'fft_headTitle', title, 'title')];
        // A value without its usual summary (for example an account payload
        // without a flavor) falls back to the stat so the row still reads
        // `title · something` instead of `title something`.
        const summaryText = head.summary !== '' ? head.summary : head.suffix;
        if (summaryText !== '') {
          nodes.push(h('span', { key: 'sep', className: 'fft_sep', 'data-shimmer-decoration': '', 'aria-hidden': true }));
          nodes.push(headText(masked, summaryClass, summaryText, 'summary'));
        }
        if (head.summary !== '' && head.suffix !== '') nodes.push(headText(masked, 'fft_headSuffix', head.suffix, 'suffix'));
        return nodes;
      };
      let bodyNodes = [];
      if (expanded) {
        if (failed) bodyNodes = [ioCard(t('tool.errorOutput'), clip(blockError(block), 1600), true)];
        else if (pending) bodyNodes = pendingBody(t, toolName, args);
        else if (model !== null) {
          if (toolName === 'fofa_search') bodyNodes = searchBody(t, model);
          else if (toolName === 'fofa_export') bodyNodes = exportBody(t, model, args, openFile);
          else bodyNodes = accountBody(t, model);
          if (spilled) bodyNodes.push(cardNote(t('tool.spilled'), 'warn'));
        } else bodyNodes = [ioCard(t('tool.output'), clip(blockText(block), 1600), false)];
      }
      return h(
        'div',
        { className: 'fft_root', 'data-tool': toolName, 'data-state': state },
        statusText === null ? null : h('span', { className: 'fft_visuallyHidden' }, statusText),
        h(
          'div',
          { className: 'fft_disclosure', 'data-open': expanded ? '' : undefined },
          h(
            'div',
            { className: 'fft_headRow', 'data-disclosure-header': '' },
            h(
              'div',
              {
                className: 'fft_row',
                'data-disclosure-row': '',
                'data-expandable': expandable ? '' : undefined,
                role: expandable ? 'button' : undefined,
                tabIndex: expandable ? 0 : undefined,
                'aria-expanded': expandable ? expanded : undefined,
                onClick: expandable ? toggle : undefined,
                onKeyDown: expandable ? onRowKeyDown : undefined,
              },
              h(
                'span',
                { className: 'fft_leading' },
                expandable && !expanded
                  ? [
                      h('span', { key: 'glyph', className: 'fft_iconIdle' }, toolIcon(toolName)),
                      chevronIcon(false, 'fft_chevronHover', 'chevron'),
                    ]
                  : expanded
                    ? chevronIcon(true)
                    : toolIcon(toolName),
              ),
              shimmerLine({ active: pending, render: renderHead }),
            ),
          ),
          expanded ? h('div', { className: 'fft_bodyWrap' }, ...bodyNodes.filter((node) => node !== null && node !== undefined)) : null,
        ),
      );
    }

    async function requestJson(path, body) {
      const request = {
        cache: 'no-store',
        headers: { accept: 'application/json', 'x-dsh-fofatoto-plugin': '1' },
      };
      if (body !== undefined) {
        request.method = 'POST';
        request.headers['content-type'] = 'application/json';
        request.body = JSON.stringify(body);
      }
      const response = await fetch(path, request);
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.ok !== true) {
        const message = asText(payload?.error) || asText(payload?.msg) || `HTTP ${response.status}`;
        const code = payload?.apiCode;
        throw new Error(code === null || code === undefined ? message : `${message} (${code})`);
      }
      return payload;
    }

    /** One async operation with its own busy/notice state, safe after unmount. */
    function useSettingsCard() {
      const [phase, setPhase] = React.useState('loading');
      const [status, setStatus] = React.useState(null);
      const [busy, setBusy] = React.useState('');
      const [notice, setNotice] = React.useState(null);
      const mounted = React.useRef(true);
      const pending = React.useRef(false);

      const applyStatus = React.useCallback((next) => {
        if (!mounted.current) return;
        setStatus(next);
        setPhase('ready');
      }, []);

      React.useEffect(() => {
        let active = true;
        mounted.current = true;
        void requestJson(ROUTE_SETTINGS).then(
          (payload) => {
            if (active) applyStatus(payload);
          },
          () => {
            if (active) setPhase('error');
          },
        );
        return () => {
          active = false;
          mounted.current = false;
        };
      }, [applyStatus]);

      const run = React.useCallback(
        async (kind, path, body, onSuccess) => {
          if (!mounted.current || pending.current) return;
          pending.current = true;
          setBusy(kind);
          setNotice(null);
          try {
            const result = await requestJson(path, body);
            if (!mounted.current) return;
            setNotice({ tone: 'ok', text: onSuccess(result) });
            if (typeof result.configured === 'boolean') applyStatus(result);
          } catch (error) {
            if (!mounted.current) return;
            setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
          } finally {
            pending.current = false;
            if (mounted.current) setBusy('');
          }
        },
        [applyStatus],
      );

      return { phase, status, busy, notice, setNotice, run };
    }

    function StatusChip({ t, phase, status }) {
      const props = { className: 'fft_chip' };
      if (phase === 'error') return h('span', { ...props, 'data-tone': 'error' }, t('status.error'));
      if (phase === 'loading') return h('span', props, t('status.loading'));
      if (status?.configured !== true) return h('span', props, t('status.missing'));
      const source = [t(`source.${status.source ?? 'none'}`), asText(status.hint)].filter(Boolean).join(' ');
      return h('span', { ...props, 'data-tone': 'ok' }, `${t('status.configured')} · ${source}`);
    }

    /** The configuration card rendered in the bundle's page on the Plugins page. */
    function FofatotoConfigCard(props) {
      const t = React.useMemo(() => makeTranslator(props?.t), [props?.t]);
      const { phase, status, busy, notice, setNotice, run } = useSettingsCard();
      const [draft, setDraft] = React.useState('');
      const [baseDraft, setBaseDraft] = React.useState(null);
      const [quotaText, setQuotaText] = React.useState('');
      const ready = phase === 'ready';
      const idle = ready && busy === '';
      const configured = status?.configured === true;
      const editable = ready && status.editable !== false;
      const draftKey = draft.trim();
      const savedBaseUrl = asText(status?.baseUrl);
      const baseInput = baseDraft ?? savedBaseUrl;
      const baseUrl = baseInput.trim();
      const baseUrlValid = isValidBaseUrl(baseUrl);
      const baseChanged = editable && baseUrl !== savedBaseUrl;
      const canSave = idle && (draftKey !== '' || baseChanged) && (!baseChanged || baseUrlValid);
      const canTest = idle && baseUrlValid && (draftKey !== '' || configured);
      const canClear = configured && status.source === 'credential';
      const feedback = phase === 'error' ? { tone: 'error', text: t('reloadHint') } : notice;

      function save() {
        if (!canSave) return;
        setQuotaText('');
        const body = {};
        if (baseChanged) body.baseUrl = baseUrl;
        if (draftKey !== '') body.apiKey = draftKey;
        void run('save', ROUTE_SETTINGS, body, (result) => {
          setDraft('');
          setBaseDraft(null);
          return result.reconfigApplied === false ? t('endpointSavedRestart') : t('saved');
        });
      }

      function test() {
        if (!canTest) return;
        setQuotaText('');
        const body = { baseUrl };
        if (draftKey !== '') body.apiKey = draftKey;
        void run('test', ROUTE_TEST, body, (result) => {
          setQuotaText(formatQuota(result.quota, t));
          return t('testOk');
        });
      }

      function clear() {
        if (!idle || !canClear) return;
        if (typeof window.confirm === 'function' && !window.confirm(t('confirmClear'))) return;
        setQuotaText('');
        void run('clear', ROUTE_SETTINGS, { clear: true }, () => t('cleared'));
      }

      function saveOnEnter(event) {
        if (event.key === 'Enter') save();
      }

      const chip = h(StatusChip, { t, phase, status });
      if (props?.view === 'summary') return h('span', { className: 'fft_summary' }, chip);

      return h(
        'div',
        { className: 'fft_card' },
        chip,
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
            disabled: !idle,
            onChange: (event) => {
              setDraft(event.target.value);
              if (notice !== null && notice.tone === 'error') setNotice(null);
            },
            onKeyDown: saveOnEnter,
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
              value: baseInput,
              autoComplete: 'off',
              spellCheck: false,
              placeholder: 'https://fofa.info',
              disabled: !idle || !editable,
              onChange: (event) => {
                setBaseDraft(event.target.value);
                if (notice !== null && notice.tone === 'error') setNotice(null);
              },
              onBlur: () => {
                if (baseChanged && !baseUrlValid) setNotice({ tone: 'error', text: t('invalidBaseUrl') });
              },
              onKeyDown: saveOnEnter,
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
                { type: 'button', className: 'fft_button fft_danger', disabled: !idle, onClick: clear },
                busy === 'clear' ? t('clearing') : t('clear'),
              )
            : null,
        ),
        feedback !== null ? h('div', { className: 'fft_notice', 'data-tone': feedback.tone, role: 'status' }, feedback.text) : null,
        quotaText !== '' ? h('p', { className: 'fft_quota' }, quotaText) : null,
        h('p', { className: 'fft_hint' }, t('hintStorage')),
        h('p', { className: 'fft_hint' }, t('hintGenerate')),
        h(
          'a',
          { className: 'fft_hint fft_link', href: PROJECT_URL, target: '_blank', rel: 'noopener noreferrer' },
          t('project'),
        ),
      );
    }

    const CSS = `
.fft_summary{color:var(--dsw-alias-label-secondary);font-size:inherit}
.fft_card{gap:8px;display:grid;max-width:100%}
.fft_chip{box-sizing:border-box;border-radius:999px;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-interactive-bg-hover);white-space:nowrap;font-size:11px;line-height:18px;padding:1px 8px;border:none;justify-self:start}
.fft_chip[data-tone=ok]{color:var(--dsw-alias-state-success-primary)}
.fft_field{gap:6px;display:grid}
.fft_fieldLabel{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.fft_input{box-sizing:border-box;width:100%;border-radius:var(--dsw-radius-sm);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:6px 10px}
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
.fft_link{color:var(--dsw-alias-brand-primary);text-decoration:none;justify-self:start}
.fft_link:hover{text-decoration:underline}
.fft_chip[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
/* Conversation tool cards. Layout, states, and motion are copied from the
   shipped ToolRow / DisclosureRow / details card so a third-party tool reads
   like a first-party one; every class is plugin-local and every color comes
   from a host theme token. */
.fft_root{display:flex;flex-direction:column}
.fft_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}
.fft_disclosure{display:flex;flex-direction:column;width:100%;min-width:0}
.fft_headRow{display:flex;align-items:center;min-width:0}
.fft_row{flex:1 1 auto;position:relative;overflow:hidden;display:flex;align-items:center;height:calc(24px + var(--dsh-content-font-delta,0px));min-width:0;color:var(--dsw-alias-label-tertiary);transition:color .1s ease}
.fft_row[data-expandable]{cursor:pointer}
.fft_row:hover{color:var(--dsw-alias-label-secondary)}
.fft_leading{position:relative;flex:none;width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));display:inline-flex;align-items:center;justify-content:center;margin-right:6px;padding:0;border:none;background:none;color:inherit}
.fft_leading svg:not([data-state]){width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}
.fft_iconIdle{display:inline-flex;opacity:1;transition:opacity .1s ease}
.fft_chevronHover{position:absolute;inset:0;margin:auto;opacity:0;transition:opacity .1s ease}
.fft_row:hover .fft_iconIdle{opacity:0}
.fft_row:hover .fft_chevronHover{opacity:1}
.fft_headTitle{flex:none;font-weight:400;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:inherit}
.fft_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;display:block;width:2px;height:2px;margin:0 8px}
.fft_headSummary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:auto;overflow:hidden}
.fft_headSuffix{white-space:nowrap;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:none;margin-left:4px}
.fft_errorSummary{color:var(--dsw-alias-state-error-primary)}
.fft_shimmer{position:relative;display:inline-grid;width:max-content;max-width:100%;min-width:0;vertical-align:top;color:inherit}
.fft_shimmerContent{display:flex;align-items:center;min-width:0}
.fft_shimmerText{color:inherit}
.fft_shimmerText[data-shimmer-text]:after{content:attr(data-shimmer-text)}
.fft_shimmerDecoration{position:absolute;inset:0;overflow:clip;pointer-events:none;user-select:none}
.fft_shimmerSweep{position:absolute;inset:0;overflow:hidden;color:var(--dsw-alias-label-shimmer);mask-image:linear-gradient(105deg,transparent 0%,black 40% 60%,transparent 100%);transform:translate(-100%);animation:fft-sweep 1.5s steps(48,end) .3s infinite}
.fft_shimmerSweep *{color:inherit!important}
.fft_shimmerSweep [data-shimmer-decoration]{background:currentColor}
.fft_shimmerHighlight{width:100%;height:100%;transform:translate(100%);animation:fft-highlight 1.5s steps(48,end) .3s infinite}
@keyframes fft-sweep{0%{transform:translate(-100%)}66.6667%,to{transform:translate(100%)}}
@keyframes fft-highlight{0%{transform:translate(100%)}66.6667%,to{transform:translate(-100%)}}
@media(prefers-reduced-motion:reduce){.fft_row{transition:none}.fft_shimmerDecoration{display:none}.fft_shimmerSweep,.fft_shimmerHighlight{animation:none}}
.fft_bodyWrap{flex-direction:column;display:flex}
.fft_detailsCard{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);margin:4px 0 4px 4px;overflow:hidden}
.fft_detailsList{max-height:none;margin:0;padding:0;list-style:none;overflow:visible}
.fft_detailsItem{margin:0;padding:10px 14px}
.fft_detailsItem+.fft_detailsItem{border-top:.5px solid var(--dsw-alias-border-l2)}
.fft_detailsHeading{flex-wrap:wrap;align-items:baseline;gap:8px;display:flex}
.fft_detailsText{white-space:pre-wrap;overflow-wrap:anywhere;flex:1;min-width:0}
.fft_detailsFields{margin:0}
.fft_detailsHeading+.fft_detailsFields{margin-top:6px}
.fft_detailsField{grid-template-columns:5.5em minmax(0,1fr);gap:12px;display:grid}
.fft_detailsField+.fft_detailsField{margin-top:4px}
.fft_detailsField dt{color:var(--dsw-alias-label-caption)}
.fft_detailsField dd{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.fft_detailsSubtitle{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;margin-top:3px;font-size:12px}
.fft_detailsDescription{color:var(--dsw-alias-label-caption);white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}
.fft_detailsBadge{color:var(--dsw-alias-label-caption);flex:none;align-items:center;gap:5px;font-size:12px;display:inline-flex}
.fft_detailsBadge:before{content:"";corner-shape:round;background:currentColor;border-radius:50%;width:5px;height:5px}
.fft_detailsBadge[data-tone=info]{color:var(--dsw-alias-state-business-primary)}
.fft_detailsBadge[data-tone=success]{color:var(--dsw-alias-state-success-primary)}
.fft_detailsBadge[data-tone=warning]{color:var(--dsw-alias-state-warn-primary)}
.fft_detailsBadge[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.fft_detailsPath{min-width:0;color:inherit;font:inherit;text-align:start;overflow-wrap:anywhere;cursor:pointer;background:0 0;border:none;flex:1;padding:0}
.fft_detailsPath:hover{text-decoration:underline}
.fft_detailsPath:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}
.fft_ioCard{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);flex-direction:column;margin:4px 0 4px 4px;display:flex}
.fft_ioSection{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;max-height:150px;padding:12px 16px;display:grid;overflow-y:auto}
.fft_ioSection::-webkit-scrollbar-thumb{border-radius:var(--dsw-radius-sm);background-clip:padding-box;border:2px solid transparent}
.fft_ioSection::-webkit-scrollbar-track{margin:6px 0}
.fft_ioLabel{color:var(--dsw-alias-label-caption);align-self:start;position:sticky;top:0}
.fft_ioText{white-space:pre-wrap;word-break:break-word;min-width:0;color:var(--dsw-alias-label-secondary)}
.fft_ioText[data-error]{color:var(--dsw-alias-state-error-primary)}
.fft_mono{font-family:var(--ds-font-family-code)}
.fft_note{white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);margin:4px 0 4px 4px}
.fft_note[data-tone=warn]{color:var(--dsw-alias-state-warn-primary)}
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
