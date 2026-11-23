import { format as nodeFormat, promisify as nodePromisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import type { HostBridge } from './host-bridge';
import type { ContextEnvelope } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

const noBridge: HostBridge = async path => {
  throw new Error(`unexpected bridge call: ${path}`);
};

const envelope = (args: unknown[]): ContextEnvelope => ({
  args,
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux', arch: 'arm64' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules: ['util'],
  grantedCapabilities: [],
});

// `run` receives (context, ...args) — the leading context arg is skipped before forwarding to
// util.format, so callers can pass exactly the args they'd pass to node:util's format directly.
const FORMAT_TAG_SOURCE =
  "module.exports.templateTags = [{ name: 'r', run: function () {" +
  ' var util = require("util");' +
  ' return util.format.apply(util, Array.prototype.slice.call(arguments, 1));' +
  ' } }];';

const runFormat = (...args: unknown[]) =>
  runTagInSandbox({ pluginSource: FORMAT_TAG_SOURCE, tagName: 'r', envelope: envelope(args), bridge: noBridge });

// Runs an arbitrary run() body (no leading-context concern — the body decides what to return) with
// util granted. Used for cases that can't cross the envelope's JSON transport (bigint, symbols,
// functions, -0/NaN/Infinity, circular references) — the literal is written directly into the
// sandboxed source and compared against the identical literal evaluated by real node:util in the
// same test, so no marshaling is required for the parity assertion to be meaningful.
//
// `body` is always a fixed string literal from a call site in this same test file (never data from
// outside the process), and it's expected to contain arbitrary JS syntax including quote/backtick
// characters (e.g. the quote-selection test below embeds a literal backtick) — escaping it would
// corrupt those cases rather than add safety. The resulting source only ever runs inside the
// disposable, isolated QuickJS sandbox this whole file is testing, never on the host.
const runBody = (body: string) =>
  runTagInSandbox({
    pluginSource: `module.exports.templateTags = [{ name: 'r', run: function () { ${body} } }];`, // lgtm[js/bad-code-sanitization]
    tagName: 'r',
    envelope: envelope([]),
    bridge: noBridge,
  });

describe('format — parity with node:util.format across JSON-transportable args', () => {
  const cases: unknown[][] = [
    ['%s', 42], ['%s', 'hello'], ['%s', true], ['%s', false], ['%s', null],
    ['%d', 42], ['%d', -3.7], ['%d', 'abc'], ['%d', '42abc'], ['%d', '  42  '], ['%d', null], ['%d', true],
    ['%i', 42], ['%i', -3.7], ['%i', 'abc'], ['%i', '3.14'], ['%i', '-5'],
    ['%f', 42], ['%f', 'abc'], ['%f', '3.14'], ['%f', '-5'],
    ['%j', { a: 1, b: [1, 2] }], ['%j', null], ['%j', [1, 2, 3]],
    ['%%'], ['100%% done', 1], ['%%', 'x'],
    ['%s %s', 'only-one'], ['%j %j', 1],
    [], ['just text'],
    [123, 'a', { x: 1 }],
    ['%s', { a: 1 }], ['%s', []], ['%s', { a: { b: { c: { d: 1 } } } }],
    ['%s', [1, [2, [3, [4]]]]], ['%s', { a: [1, 2, 3] }],
    ['%s', { 'a-b': 1, 2: 'x', 1: 'y', normal: 'z' }],
    ["%s", { a: "it's" }], ['%s', { a: 'she said "hi"' }],
    ['%O', { a: { b: { c: { d: 1 } } } }], ['%O', [1, [2, [3, [4]]]]], ['%O', 'abc'], ['%O', []],
    ['extra', { a: { b: { c: { d: 1 } } } }], ['extra', [1, [2, [3, [4]]]]],
    ['%c', 'css', 'leftover'],
    ['%z unknown specifier %s', 'val'],
  ];

  it.each(cases)('format(%j) matches node:util', async (...args) => {
    const expected = nodeFormat(...(args as []));
    const actual = await runFormat(...args);
    expect(actual).toBe(expected);
  });
});

describe('format — parity for values that cannot cross the JSON envelope', () => {
  // `literal` is the exact source text embedded into the sandboxed run() body; `value` builds the
  // same value directly (no eval) for the real node:util comparison — both sides construct their
  // own copy of the value from scratch, so no marshaling occurs either way.
  const literalCases: { spec: string; literal: string; value: () => unknown }[] = [
    { spec: '%s', literal: '-0', value: () => -0 },
    { spec: '%d', literal: '-0', value: () => -0 },
    { spec: '%i', literal: '-0.5', value: () => -0.5 },
    { spec: '%f', literal: '"-0"', value: () => '-0' },
    { spec: '%s', literal: 'NaN', value: () => Number.NaN },
    { spec: '%s', literal: 'Infinity', value: () => Infinity },
    { spec: '%s', literal: '-Infinity', value: () => -Infinity },
    { spec: '%s', literal: '10n', value: () => 10n },
    { spec: '%d', literal: '10n', value: () => 10n },
    { spec: '%i', literal: '10n', value: () => 10n },
    { spec: '%f', literal: '10n', value: () => 10n },
    { spec: '%s', literal: 'Symbol("s")', value: () => Symbol('s') },
    { spec: '%d', literal: 'Symbol("s")', value: () => Symbol('s') },
    { spec: '%i', literal: 'Symbol("s")', value: () => Symbol('s') },
    { spec: '%f', literal: 'Symbol("s")', value: () => Symbol('s') },
  ];

  it.each(literalCases)('format("%s", %s) matches node:util', async ({ spec, literal, value }) => {
    const actual = await runBody(`return require("util").format(${JSON.stringify(spec)}, ${literal});`);
    const expected = nodeFormat(spec, value());
    expect(actual).toBe(expected);
  });

  it('format("%s", fn) renders raw source (matches Function.prototype.toString, not [Function: name])', async () => {
    const source = 'function foo() { return 1; }';
    const actual = await runBody(`${source} return require("util").format("%s", foo);`);
    // %s's raw-source rendering is exactly String(fn) — plain Function.prototype.toString semantics,
    // not a util.format-specific computation — so the expected text is the literal source itself
    // rather than a separately-declared comparison function (which risks an unrelated identifier
    // collision with other functions of the same name declared elsewhere in this file).
    expect(actual).toBe(source);
  });

  it('format("%O", fn) matches node:util ([Function: name])', async () => {
    const actual = await runBody('function namedFn() { return 1; } return require("util").format("%O", namedFn);');
    function namedFn() { return 1; }
    expect(actual).toBe(nodeFormat('%O', namedFn));
  });

  it('format("%O", anonymous fn) renders [Function (anonymous)]', async () => {
    const actual = await runBody('return require("util").format("%O", (function () { return 1; }));');
    expect(actual).toBe('[Function (anonymous)]');
  });

  it('format nests functions inside objects as [Function: name]', async () => {
    const actual = await runBody(
      'return require("util").format("%s", { fn: function bar() {}, fn2: function () {} });',
    );
    expect(actual).toBe(nodeFormat('%s', { fn: function bar() {}, fn2: function () {} }));
  });

  it('format("%j", circular) matches node:util\'s "[Circular]" fallback', async () => {
    const actual = await runBody('var o = {}; o.self = o; return require("util").format("%j", o);');
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(actual).toBe(nodeFormat('%j', o));
  });

  it('format("%j", bigint) throws — matches node:util (JSON cannot serialize BigInt)', async () => {
    await expect(runBody('return require("util").format("%j", 10n);')).rejects.toThrow();
    expect(() => nodeFormat('%j', 10n)).toThrow();
  });

  it('quote-selection picks a quote character absent from the string, falling back to escaped single quotes', async () => {
    const actual = await runBody(
      'return require("util").format("%s", { a: "both \' and \\" and ` here" });',
    );
    expect(actual).toBe(nodeFormat('%s', { a: 'both \' and " and ` here' }));
  });
});

describe('promisify', () => {
  it('resolves with the callback\'s single value', async () => {
    const actual = await runBody(
      'function cb(a, b, done) { done(null, a + b); }' +
      ' return require("util").promisify(cb)(2, 3);',
    );
    expect(actual).toBe('5');
  });

  it('resolves with only the first value when the callback passes several', async () => {
    const actual = await runBody(
      'function cb(done) { done(null, 1, 2, 3); }' +
      ' return require("util").promisify(cb)();',
    );
    expect(actual).toBe('1');
  });

  it('resolves with undefined when the callback passes no value', async () => {
    const actual = await runBody(
      'function cb(done) { done(null); }' +
      ' return require("util").promisify(cb)();',
    );
    expect(actual).toBe('');
  });

  it('rejects when the callback is invoked with a truthy error', async () => {
    await expect(
      runBody(
        'function cb(done) { done(new Error("boom")); }' +
        ' return require("util").promisify(cb)();',
      ),
    ).rejects.toThrow('boom');
  });

  it('treats a falsy non-null error (0) as success, matching node:util', async () => {
    const actual = await runBody(
      'function cb(done) { done(0, "ok"); }' +
      ' return require("util").promisify(cb)();',
    );
    expect(actual).toBe('ok');
  });

  it('honors a Symbol.for("nodejs.util.promisify.custom") override', async () => {
    const actual = await runBody(
      'function cb() {}' +
      ' cb[Symbol.for("nodejs.util.promisify.custom")] = function () { return Promise.resolve("custom-value"); };' +
      ' return require("util").promisify(cb)();',
    );
    expect(actual).toBe('custom-value');
  });

  it('throws for a non-function argument, matching node:util', async () => {
    await expect(runBody('return require("util").promisify(42);')).rejects.toThrow();
    expect(() => nodePromisify(42 as never)).toThrow();
  });
});

describe('types.is*', () => {
  const cases: [string, string, boolean][] = [
    ['isDate', 'new Date()', true], ['isDate', '{}', false],
    ['isRegExp', '/x/', true], ['isRegExp', '{}', false],
    ['isPromise', 'Promise.resolve()', true], ['isPromise', '{}', false],
    ['isMap', 'new Map()', true], ['isMap', 'new Set()', false],
    ['isSet', 'new Set()', true], ['isSet', 'new Map()', false],
    ['isWeakMap', 'new WeakMap()', true], ['isWeakMap', 'new Map()', false],
    ['isWeakSet', 'new WeakSet()', true],
    ['isArrayBuffer', 'new ArrayBuffer(1)', true], ['isArrayBuffer', 'new Uint8Array(1)', false],
    ['isDataView', 'new DataView(new ArrayBuffer(1))', true],
    ['isTypedArray', 'new Uint8Array(1)', true],
    ['isTypedArray', 'new DataView(new ArrayBuffer(1))', false],
    ['isTypedArray', '[]', false],
    ['isNativeError', 'new Error("x")', true], ['isNativeError', '{}', false],
    ['isBooleanObject', 'new Boolean(true)', true], ['isBooleanObject', 'true', false],
    ['isNumberObject', 'new Number(1)', true], ['isNumberObject', '1', false],
    ['isStringObject', 'new String("x")', true], ['isStringObject', '"x"', false],
    ['isAsyncFunction', 'async function () {}', true], ['isAsyncFunction', 'function () {}', false],
    ['isGeneratorFunction', 'function* () {}', true], ['isGeneratorFunction', 'function () {}', false],
  ];

  it.each(cases)('types.%s(%s) === %s', async (method, literal, expected) => {
    const actual = await runBody(`return String(require("util").types.${method}(${literal}));`);
    expect(actual).toBe(String(expected));
  });

  it('is not part of the module\'s enumerable top-level surface beyond format/promisify/types', async () => {
    const actual = await runBody('return Object.keys(require("util")).sort().join(",");');
    expect(actual).toBe('format,promisify,types');
  });

  it('does not implement util.inspect — an explicit, documented exclusion', async () => {
    const actual = await runBody('return String(require("util").inspect);');
    expect(actual).toBe('undefined');
  });
});
