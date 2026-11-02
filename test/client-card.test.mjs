/**
 * Client-half tests for the conversation cards.
 *
 * The bundle is a browser module (`window.__ModuleLoader__.load` + `require('react')`),
 * so this test fakes the loader and React just far enough to run `apply()` and
 * render each card variant. It never asserts pixels: it proves the cards run
 * without throwing, register in the right keyed slots, expose the shipped tool
 * row contract (`data-disclosure-row`, details card, shimmer), and show localized copy.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    // Persistent cell: the card freezes its disclosure Hook in a ref on the
    // first render, and that must survive re-renders like the real useRef.
    useRef: (value) => {
      const index = cursor;
      cursor += 1;
      if (cells[index] === undefined) cells[index] = { current: value };
      return cells[index];
    },
    useCallback: (callback) => callback,
    useEffect: () => {},
  };
}

/** Visit every element of one rendered tree. */
function walk(node, visit) {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node !== 'object') return;
  visit(node);
  walk(node.props?.children, visit);
}

/** First element matching `predicate`. */
function find(tree, predicate) {
  let hit = null;
  walk(tree, (node) => {
    if (hit === null && predicate(node)) hit = node;
  });
  return hit;
}

/** Every element whose `className` contains `name`. */
function byClass(tree, name) {
  const hits = [];
  walk(tree, (node) => {
    const className = node.props?.className;
    if (typeof className === 'string' && className.split(' ').includes(name)) hits.push(node);
  });
  return hits;
}

/** Every string inside one rendered element tree. */
function textsOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textsOf);
  if (typeof node === 'object') return textsOf(node.props?.children);
  return [];
}

/** The clickable disclosure head of one card. */
function rowNode(tree) {
  return find(tree, (node) => node.props !== undefined && node.props['data-disclosure-row'] !== undefined);
}

/** Owner-supplied disclosure Hook: one stable state cell per mounted card. */
function makeDisclosure() {
  let expanded = false;
  return () => ({ expanded, toggle: () => { expanded = !expanded; } });
}

/** Render one card collapsed; `toggle()` activates the head and re-renders. */
function mount(react, card, props, withOwner = true) {
  const useDisclosure = makeDisclosure();
  const view = withOwner ? { ...props, useDisclosure } : { ...props };
  react.reset();
  react.begin();
  const collapsed = card(view);
  return {
    collapsed,
    expanded() {
      const head = rowNode(collapsed);
      assert.ok(head, 'the card renders a disclosure row');
      assert.equal(typeof head.props.onClick, 'function', 'the row is expandable');
      head.props.onClick();
      react.begin();
      return card(view);
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

const SEARCH_BLOCK = {
  kind: 'result',
  isError: false,
  call: { name: 'fofa_search', argsRaw: '{"query":"domain=\\"a.com\\"","size":2,"fields":"host,ip"}' },
  content: [
    {
      type: 'text',
      text: '命中 2 条 · 本页 1 条 · 去重 IP 1\n{"query":"domain=\\"a.com\\"","total":2,"page":1,"size":1,"fields":"host,ip","uniqueIps":1,"rows":[{"host":"a.a.com","ip":"1.2.3.4","port":"443","title":"A"}]}',
    },
  ],
};

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
  for (const key of ['tool.uniqueIps', 'tool.output', 'tool.errorOutput', 'tool.validBadge', 'tool.invalidBadge']) {
    assert.equal(typeof dictionaries[0].dict.zh[key], 'string', `zh dictionary carries ${key}`);
    assert.equal(typeof dictionaries[0].dict.en[key], 'string', `en dictionary carries ${key}`);
  }
});

test('tool cards use the shipped row contract: root state, glyph, disclosure row', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;

  const view = mount(react, card, { toolName: 'fofa_search', phase: 'result', t, block: SEARCH_BLOCK });
  const root = view.collapsed;
  assert.equal(root.props.className, 'fft_root');
  assert.equal(root.props['data-tool'], 'fofa_search');
  assert.equal(root.props['data-state'], 'ok');

  const head = rowNode(view.collapsed);
  assert.notEqual(head.props['data-expandable'], undefined, 'the row is marked expandable');
  assert.equal(head.props.role, 'button');
  assert.equal(head.props.tabIndex, 0);
  assert.equal(head.props['aria-expanded'], false);

  // Glyph + hover chevron: two siblings inside the leading cell while closed.
  const leading = byClass(view.collapsed, 'fft_leading')[0];
  assert.ok(leading, 'leading cell exists');
  assert.equal(byClass(leading, 'fft_iconIdle').length, 1, 'tool glyph is shown while closed');
  assert.equal(byClass(leading, 'fft_chevronHover').length, 1, 'chevron waits for hover');
  const glyph = find(leading, (node) => node.type === 'svg' && node.props.viewBox === '0 0 16 16');
  assert.ok(glyph, 'glyph is the shipped 16x16 outline icon');
  assert.equal(glyph.props.strokeWidth, 1);

  // Collapsed head = title, separator, summary (the query), and the stat suffix.
  assert.equal(byClass(view.collapsed, 'fft_sep').length, 1);
  const headSummary = byClass(view.collapsed, 'fft_headSummary')[0];
  assert.ok(headSummary, 'the query rides in the flexible summary slot');
  assert.match(textsOf(headSummary).join('|'), /domain="a\.com"/u);
  const headSuffix = byClass(view.collapsed, 'fft_headSuffix')[0];
  assert.ok(headSuffix, 'the stat rides in the fixed summary suffix slot');
  assert.match(textsOf(headSuffix).join('|'), /命中 2 条/u);
  const headTexts = textsOf(view.collapsed).join('|');
  assert.match(headTexts, /FOFA 检索/u);
  assert.match(headTexts, /命中 2 条/u);
  assert.match(headTexts, /domain="a\.com"/u);
  assert.equal(find(view.collapsed, (node) => node.props?.className === 'fft_bodyWrap'), null, 'collapsed by default');

  const expanded = view.expanded();
  const openHead = rowNode(expanded);
  assert.equal(openHead.props['aria-expanded'], true);
  assert.equal(byClass(expanded, 'fft_iconIdle').length, 0, 'the open row shows only the chevron');
  assert.equal(byClass(expanded, 'fft_chevronHover').length, 0);
  assert.equal(find(expanded, (node) => node.props?.className === 'fft_bodyWrap') !== null, true);
});

test('settled search card expands into a details card with config and preview rows', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;
  const view = mount(react, card, { toolName: 'fofa_search', phase: 'result', t, block: SEARCH_BLOCK });

  const expanded = view.expanded();
  assert.equal(byClass(expanded, 'fft_detailsCard').length, 1, 'body is one details card');
  assert.equal(byClass(expanded, 'fft_detailsItem').length, 2, 'request item plus one preview row');
  const text = textsOf(expanded).join('|');
  assert.match(text, /domain="a\.com"/u);
  assert.match(text, /host,ip/u);
  assert.match(text, /a\.a\.com/u);
  assert.match(text, /1\.2\.3\.4:443/u);
  assert.match(text, /条数/u);
  assert.match(text, /页码/u);
  // Fields render as dl/dt/dd pairs, like the shipped details card.
  assert.ok(byClass(expanded, 'fft_detailsField').length >= 4);
  assert.equal(find(expanded, (node) => node.type === 'dt') !== null, true);
});

test('settled export card shows the file link and counters', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;
  const view = mount(react, card, {
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

  const head = textsOf(view.collapsed).join('|');
  assert.match(head, /2 行/u);
  assert.match(head, /domain="a\.com"/u);
  // The head summary is the query alone: the format still shows in the body only.
  const exportSummary = byClass(view.collapsed, 'fft_headSummary')[0];
  assert.ok(exportSummary, 'the query is the head summary');
  assert.equal(textsOf(exportSummary).join(''), 'domain="a.com"');
  const exportSuffix = byClass(view.collapsed, 'fft_headSuffix')[0];
  assert.ok(exportSuffix, 'the row count is the head suffix');
  assert.match(textsOf(exportSuffix).join('|'), /2 行/u);

  const expanded = view.expanded();
  const text = textsOf(expanded).join('|');
  assert.match(text, /C:\\work\\out\.csv/u);
  assert.match(text, /已取完/u);
  assert.match(text, /1000/u);
  assert.match(text, /host,ip/u);
  assert.match(text, /去重字段/u);
  assert.match(text, /url/u);
  // The recorded path is an openable button, as the shipped file rows do.
  const pathButton = find(expanded, (node) => node.type === 'button' && node.props.className === 'fft_detailsPath');
  assert.ok(pathButton, 'the export path is clickable');
  assert.equal(byClass(expanded, 'fft_ioCard').length, 0, 'settled data uses the details card, not raw IO');
});

test('running card shimmers, hides its body while preparing, and expands with the request', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;
  const argsRaw = '{"query":"domain=\\"a.com\\"","size":2,"fields":"host,ip"}';

  // Preparing: one non-expandable row, no body.
  const preparing = mount(react, card, {
    toolName: 'fofa_search',
    phase: 'preparing',
    t,
    block: { phase: 'preparing', argsRaw },
  });
  assert.equal(preparing.collapsed.props['data-state'], 'preparing');
  const preparingHead = rowNode(preparing.collapsed);
  assert.equal(preparingHead.props['data-expandable'], undefined);
  assert.equal(preparingHead.props.onClick, undefined);
  assert.equal(byClass(preparing.collapsed, 'fft_shimmerDecoration').length, 1, 'running rows shimmer');

  // Running (start): expandable, still shimmering, body carries the request.
  const running = mount(react, card, {
    toolName: 'fofa_search',
    phase: 'start',
    t,
    block: { phase: 'start', argsRaw },
  });
  assert.equal(running.collapsed.props['data-state'], 'running');
  const hidden = textsOf(running.collapsed).join('|');
  assert.match(hidden, /执行中/u, 'running state is announced for screen readers');
  const expanded = running.expanded();
  const text = textsOf(expanded).join('|');
  assert.match(text, /domain="a\.com"/u);
  assert.match(text, /条数/u);
  assert.match(text, /host,ip/u);
});

test('failure and spilled cards keep their state, color cue, and durable facts', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;

  // Failed call: red summary in the head, raw error text in the IO panel.
  const failed = mount(react, card, {
    toolName: 'fofa_account',
    phase: 'result',
    t,
    block: { kind: 'result', isError: true, content: [{ type: 'text', text: 'Error: 尚未配置 FOFA API Key。' }] },
  });
  assert.equal(failed.collapsed.props['data-state'], 'error');
  const failedText = textsOf(failed.collapsed).join('|');
  assert.match(failedText, /尚未配置 FOFA API Key/u);
  assert.match(failedText, /失败/u);
  const errorSummary = find(failed.collapsed, (node) => {
    const className = node.props?.className;
    return typeof className === 'string' && className.includes('fft_headSummary') && className.includes('fft_errorSummary');
  });
  assert.ok(errorSummary, 'error summaries keep the error color class');
  const failedExpanded = failed.expanded();
  const failedBody = textsOf(failedExpanded).join('|');
  assert.match(failedBody, /错误/u);
  const errorText = find(failedExpanded, (node) => node.props !== undefined && node.props['data-error'] !== undefined);
  assert.ok(errorText, 'error output is flagged for the error color');

  // Spilled result: content is a disk locator, facts come from result.meta.
  const spilled = mount(react, card, {
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
  assert.equal(spilled.collapsed.props['data-state'], 'ok');
  const spilledHead = textsOf(spilled.collapsed).join('|');
  assert.match(spilledHead, /78717/u);
  assert.match(spilledHead, /domain="baidu\.com"/u);
  const spilledBody = textsOf(spilled.expanded()).join('|');
  assert.match(spilledBody, /1000/u);
  assert.match(spilledBody, /a\.baidu\.com/u);
  assert.match(spilledBody, /落盘/u);
});

test('legacy session logs and an account result still render', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;
  const legacy = mount(react, card, {
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
  assert.equal(legacy.collapsed.props['data-state'], 'ok');
  const legacyHead = textsOf(legacy.collapsed).join('|');
  assert.match(legacyHead, /中转站/u);
  assert.match(legacyHead, /今日剩余 91/u);
  const expanded = legacy.expanded();
  const text = textsOf(expanded).join('|');
  assert.match(text, /91/u);
  assert.match(text, /有效/u);
  assert.match(text, /https:\/\/fafaapi\.info/u);
});

test('a card mounted without the owner Hook falls back to local disclosure state', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;
  const view = mount(react, card, { toolName: 'fofa_search', phase: 'result', t, block: SEARCH_BLOCK }, false);
  assert.equal(typeof rowNode(view.collapsed).props.onClick, 'function');
  const expanded = view.expanded();
  assert.equal(byClass(expanded, 'fft_detailsCard').length, 1);
  assert.match(textsOf(expanded).join('|'), /domain="a\.com"/u);
});

test('an empty search page says so inside the details card', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;
  const block = {
    kind: 'result',
    isError: false,
    call: { name: 'fofa_search', argsRaw: '{"query":"domain=\\"none.invalid\\"","size":50}' },
    content: [
      {
        type: 'text',
        text: '命中 0 条 · 本页 0 条\n{"query":"domain=\\"none.invalid\\"","total":0,"page":1,"size":50,"fields":"host,ip","rows":[]}',
      },
    ],
  };
  const view = mount(react, card, { toolName: 'fofa_search', phase: 'result', t, block });
  assert.equal(view.collapsed.props['data-state'], 'ok');
  assert.match(textsOf(view.expanded()).join('|'), /本页没有结果/u);
});

test('the head handles empty, partial, clipped and malformed values', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;
  const settle = (toolName, text, name) =>
    mount(react, card, {
      toolName,
      phase: 'result',
      t,
      block: { kind: 'result', isError: false, call: { name, argsRaw: '{}' }, content: [{ type: 'text', text }] },
    });

  // Missing/null total never reaches the DOM; the suffix degrades to zero.
  const nullTotal = settle('fofa_search', '{"query":"a","total":null,"rows":[]}', 'fofa_search');
  const nullTotalSuffix = byClass(nullTotal.collapsed, 'fft_headSuffix')[0];
  assert.ok(nullTotalSuffix);
  assert.match(textsOf(nullTotalSuffix).join('|'), /命中 0 条/u);
  assert.equal(textsOf(nullTotal.collapsed).join('|').includes('null'), false);

  // Partial export: the stat suffix carries both the count and the partial mark.
  const partial = settle('fofa_export', '{"path":"C:\\\\out\\\\a.csv","written":3,"partial":true,"stoppedReason":"time-budget"}', 'fofa_export');
  const partialSuffixText = textsOf(byClass(partial.collapsed, 'fft_headSuffix')[0]).join('|');
  assert.match(partialSuffixText, /3 行/u);
  assert.match(partialSuffixText, /部分完成/u);

  // Export without a query falls back to the recorded path in the summary slot.
  const pathOnly = settle('fofa_export', '{"path":"C:\\\\out\\\\b.csv","written":1}', 'fofa_export');
  assert.match(textsOf(byClass(pathOnly.collapsed, 'fft_headSummary')[0]).join('|'), /b\.csv/u);

  // A payload without its usual summary keeps the dot by lending the suffix slot:
  // the stat moves into the flexible summary and no suffix span is rendered.
  const noFlavor = settle('fofa_account', '{"account":{"type":null,"todayRemaining":5}}', 'fofa_account');
  assert.equal(byClass(noFlavor.collapsed, 'fft_headSuffix').length, 0);
  const flatSummary = byClass(noFlavor.collapsed, 'fft_headSummary')[0];
  assert.match(textsOf(flatSummary).join('|'), /今日剩余 5/u);

  // Long queries clip to code points (no broken surrogate pairs).
  const longQuery = 'д'.repeat(100);
  const clipped = settle('fofa_search', JSON.stringify({ query: longQuery, total: 1, rows: [] }), 'fofa_search');
  const clippedText = textsOf(byClass(clipped.collapsed, 'fft_headSummary')[0]).join('');
  assert.equal(Array.from(clippedText).length, 73);
  assert.equal(clippedText.endsWith('…'), true);
});

test('the running shimmer layers mirror the same head text', async () => {
  const { registrations, react } = await loadClient();
  const card = registrations.find((entry) => entry.options.name === 'tool.call.toolview').component;
  const t = (key) => key;
  const argsRaw = '{"query":"domain=\\"a.com\\"","size":2}';
  const running = mount(react, card, {
    toolName: 'fofa_search',
    phase: 'start',
    t,
    block: { phase: 'start', argsRaw },
  });
  const layers = byClass(running.collapsed, 'fft_shimmerContent');
  assert.equal(layers.length, 2, 'base layer plus masked sweep layer');
  const masked = [];
  walk(layers[1], (node) => {
    const text = node.props?.['data-shimmer-text'];
    if (typeof text === 'string') masked.push(text);
  });
  assert.equal(masked.join('|'), textsOf(layers[0]).join('|'), 'the sweep copies the head text verbatim');
});

test('tool card styles stay on host theme tokens', async () => {
  const bundle = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  const start = bundle.indexOf('.fft_root{');
  const end = bundle.indexOf('`;', start);
  assert.ok(start !== -1 && end !== -1, 'tool-card stylesheet is present');
  const css = bundle.slice(start, end);
  assert.equal(/:\s*#(?:[0-9a-f]{3,8})\b/iu.test(css), false, 'no literal hex colors');
  assert.equal(/(?:^|[-\w])(?:rgba?|hsla?)\(/iu.test(css), false, 'no literal rgb/hsl colors');
  const tokens = [...css.matchAll(/var\((--[a-z0-9-]+)/giu)].map((match) => match[1]);
  assert.ok(tokens.length > 10);
  // Head classes are plugin-local: they must not reuse the Plugins-page card names,
  // and the slider/suffix pair must be styled.
  for (const own of ['fft_headRow{', 'fft_headTitle{', 'fft_headSummary{', 'fft_headSuffix{']) {
    assert.equal(css.includes(`.${own}`), true, `head styling defines .${own}`);
  }
  for (const legacy of ['fft_header{', 'fft_title{', 'fft_summary{']) {
    assert.equal(css.includes(`.${legacy}`), false, `the tool-card block must not restyle .${legacy}`);
  }
  const allowed = /^--(?:dsw-alias-|dsw-radius-|dsw-font-|dsw-focus-ring-|dsh-content-font-|ds-font-family-)/u;
  for (const token of new Set(tokens)) {
    assert.match(token, allowed, `token ${token} belongs to the host theme`);
  }
  // The pre-restyle boxed card is gone.
  assert.equal(bundle.includes('fft_toolHead'), false);
  assert.equal(bundle.includes('.fft_chev{'), false);
  assert.equal(bundle.includes('fft_toolSummary'), false);
});
