/**
 * The curated "sandbox stdlib": the single source of truth for every module reachable from plugin
 * code via `require()` inside the QuickJS sandbox. Each entry maps a canonical name to a factory
 * evaluated *inside* the sandbox, so implementations are always safe equivalents — pure-JS
 * reimplementations or shims over vetted host functions — never raw Node builtins.
 *
 * Resolution is default-deny and two-staged (see `__require` in `in-sandbox-bootstrap.ts`):
 *   1. a name outside the plugin's granted set throws "Module 'X' not permitted by manifest";
 *   2. a granted name with no registry entry throws "Module 'X' not available in sandbox".
 * Both messages are user-facing contract — they tell a plugin author which of the two problems
 * they have — and are asserted verbatim by unit and smoke tests.
 *
 * Authoring constraint: factory sources are plain JS strings evaluated by QuickJS, so they avoid
 * template literals / optional chaining / modern globals and stick to widely-supported ES5-ish JS
 * (same rule as `in-sandbox-bootstrap.ts`).
 */

import { AJV_FACTORY_SOURCE, AJV_FACTORY_VERSION } from './vendored/ajv.generated';
import { UUID_FACTORY_SOURCE, UUID_FACTORY_VERSION } from './vendored/uuid.generated';

export interface SandboxModuleDefinition {
  /** Canonical registry name — also the name a plugin manifest will declare (C3). */
  name: string;
  /** Alternate request specifiers that resolve to this module (e.g. the `node:` prefixed form). */
  aliases?: string[];
  /**
   * Large vendored npm bundles (M3) — only included in the eval'd registry source when the plugin
   * actually declared them, so a render that doesn't use them never pays to parse hundreds of KB.
   * Baseline/reimpl modules are small and always registered.
   */
  heavy?: boolean;
  /**
   * ES5 function-expression source, evaluated inside the sandbox, that returns the module's
   * exports. Invoked at most once per sandbox context — `__require` caches the exports object.
   *
   * SECURITY INVARIANT: this string is interpolated **verbatim** (not escaped) into
   * `MODULE_REGISTRY_SOURCE` and eval'd inside the sandbox, so it MUST be a trusted, in-repo
   * literal. Never derive it from plugin manifests, user input, or anything fetched at runtime —
   * doing so is code injection into the sandbox bootstrap.
   */
  factorySource: string;
}

const PATH_FACTORY = [
  'function () {',
  '  return {',
  '    sep: "/",',
  '    basename: function (p) { var s = String(p).split("/"); return s[s.length - 1]; },',
  '    extname: function (p) { var b = String(p).split("/").pop(); var d = b.lastIndexOf("."); return d > 0 ? b.slice(d) : ""; },',
  '    join: function () { return Array.prototype.slice.call(arguments).join("/").replace(/\\/+/g, "/"); }',
  '  };',
  '}',
].join('\n');

// crypto is backed by synchronous host functions (real host crypto), so digest()/randomBytes()
// return values inline — matching node:crypto's synchronous contract. The actual createHash/
// createHmac/randomBytes/randomUUID implementation lives in sandbox-globals.ts's
// `globalThis.__nodeCryptoExports`, built eagerly in the same scope that captures the raw
// `__crypto*` host natives — this factory only runs lazily (on the plugin's first `require('crypto')`
// call), by which point those raw natives are already gone from `globalThis`, so it can't read them
// directly. It reads `__cryptoExportsCapture` instead — a variable closed over from
// buildModuleRegistrySource's wrapping IIFE (see below), not `globalThis.__nodeCryptoExports`
// directly, which is captured-then-deleted there before any plugin code runs.
const CRYPTO_FACTORY = [
  'function () {',
  '  if (typeof __cryptoExportsCapture === "undefined") { throw new Error("\'crypto\' is not available in this sandbox"); }',
  '  return __cryptoExportsCapture;',
  '}',
].join('\n');

// A minimal, pure-JS EventEmitter — the first non-baseline registry module, so a manifest that
// declares `"modules": ["events"]` grants something a baseline plugin cannot reach (C3). Covers the
// common surface (on/once/emit/removeListener); the full Node API is out of scope until a plugin
// needs more. Registered here but NOT in the template-tag baseline — it requires an explicit grant.
const EVENTS_FACTORY = [
  'function () {',
  '  function EventEmitter() { this._events = Object.create(null); }',
  '  EventEmitter.prototype.on = function (type, fn) {',
  '    (this._events[type] = this._events[type] || []).push(fn); return this;',
  '  };',
  '  EventEmitter.prototype.addListener = EventEmitter.prototype.on;',
  '  EventEmitter.prototype.once = function (type, fn) {',
  '    var self = this; function g() { self.removeListener(type, g); fn.apply(this, arguments); }',
  '    g.listener = fn; return this.on(type, g);',
  '  };',
  '  EventEmitter.prototype.removeListener = function (type, fn) {',
  '    var list = this._events[type]; if (!list) { return this; }',
  '    for (var i = list.length - 1; i >= 0; i--) { if (list[i] === fn || list[i].listener === fn) { list.splice(i, 1); } }',
  '    return this;',
  '  };',
  '  EventEmitter.prototype.removeAllListeners = function (type) {',
  '    if (type === undefined) { this._events = Object.create(null); } else { delete this._events[type]; } return this;',
  '  };',
  '  EventEmitter.prototype.listeners = function (type) { return (this._events[type] || []).slice(); };',
  '  EventEmitter.prototype.emit = function (type) {',
  '    var list = this._events[type]; if (!list || !list.length) { return false; }',
  '    var args = Array.prototype.slice.call(arguments, 1);',
  '    var copy = list.slice(); for (var i = 0; i < copy.length; i++) { copy[i].apply(this, args); } return true;',
  '  };',
  '  return { EventEmitter: EventEmitter };',
  '}',
].join('\n');

// A pure-JS `assert` reimplementation. Deep-equality tracks visited [a, b] pairs to stay safe on
// circular structures; Map/Set/WeakMap/WeakSet/TypedArray/ArrayBuffer operands and Symbol-keyed own
// properties throw an explicit "not supported" error rather than risk a silently-wrong comparison
// (Object.keys alone can't see into a Map/Set's internal entries). That detection checks both the
// Object.prototype.toString tag and `instanceof`, because the tag alone is spoofable by a Proxy
// whose `get` trap reports a different Symbol.toStringTag for a real Map/Set/WeakMap/WeakSet/
// ArrayBuffer — instanceof is unaffected by a toStringTag-only spoof since it walks the prototype
// chain instead. A Proxy that also fakes its prototype chain via a `getPrototypeOf` trap is a
// documented residual gap (PERMISSIONS.md) — real Node's own deepStrictEqual has the identical
// limitation against that same craft, so this is not a sandbox-specific regression. `throws()`'s
// matcher supports a RegExp (tests `.message`), an Error-derived constructor (`instanceof` check), a
// plain validator function (called with the thrown value), or a plain object (own-enumerable-property
// subset match) — legacy Node's string-as-matcher form is not implemented. Thrown `AssertionError`s
// carry the same name/message/actual/expected/operator shape as real Node's and satisfy
// `instanceof Error` and `instanceof AssertionError`; exact message wording is not guaranteed to
// match Node's own formatting.
const ASSERT_FACTORY = [
  'function () {',
  '  function isDate(v) { return Object.prototype.toString.call(v) === "[object Date]"; }',
  '  function isRegExp(v) { return Object.prototype.toString.call(v) === "[object RegExp]"; }',
  '  function sameValueZero(a, b) { return a === b || (a !== a && b !== b); }',
  '  function ownKeys(o) { return Object.keys(o).sort(); }',
  '',
  '  var UNSUPPORTED_DEEP_EQUAL_TAGS = {',
  '    "[object Map]": true, "[object Set]": true, "[object WeakMap]": true, "[object WeakSet]": true,',
  '    "[object ArrayBuffer]": true, "[object Int8Array]": true, "[object Uint8Array]": true,',
  '    "[object Uint8ClampedArray]": true, "[object Int16Array]": true, "[object Uint16Array]": true,',
  '    "[object Int32Array]": true, "[object Uint32Array]": true, "[object Float32Array]": true,',
  '    "[object Float64Array]": true, "[object BigInt64Array]": true, "[object BigUint64Array]": true',
  '  };',
  '',
  // Object.prototype.toString's tag alone is not a reliable brand check: a Proxy whose "get" trap
  // reports a spoofed Symbol.toStringTag (e.g. "Object") for a real Map/Set/WeakMap/WeakSet/
  // ArrayBuffer makes the tag lookup above see the spoofed value, even though the operand still
  // behaves like the real thing for every other operation. instanceof walks the prototype chain
  // instead (via [[GetPrototypeOf]], which a Proxy forwards to its target unless a getPrototypeOf
  // trap is also defined) and is unaffected by a toStringTag-only spoof, so it is checked too rather
  // than trusting the tag in isolation. This does not defend against a Proxy that fakes its
  // prototype chain as well (documented as a residual gap in PERMISSIONS.md).
  '  function isUnsupportedDeepEqualOperand(v) {',
  '    if (v === null || typeof v !== "object") { return false; }',
  '    if (UNSUPPORTED_DEEP_EQUAL_TAGS[Object.prototype.toString.call(v)]) { return true; }',
  '    if (typeof Map === "function" && v instanceof Map) { return true; }',
  '    if (typeof Set === "function" && v instanceof Set) { return true; }',
  '    if (typeof WeakMap === "function" && v instanceof WeakMap) { return true; }',
  '    if (typeof WeakSet === "function" && v instanceof WeakSet) { return true; }',
  '    if (typeof ArrayBuffer === "function" && v instanceof ArrayBuffer) { return true; }',
  '    return false;',
  '  }',
  '',
  '  function deepEqual(a, b, strict, seen) {',
  '    if (strict ? a === b : (a == b || sameValueZero(a, b))) { return true; }',
  '    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") { return false; }',
  '    if (isUnsupportedDeepEqualOperand(a) || isUnsupportedDeepEqualOperand(b)) {',
  '      throw new Error("assert deepEqual/deepStrictEqual: Map/Set/TypedArray/ArrayBuffer comparison is not supported in this sandbox");',
  '    }',
  '    if (Object.getOwnPropertySymbols(a).length || Object.getOwnPropertySymbols(b).length) {',
  '      throw new Error("assert deepEqual/deepStrictEqual: Symbol-keyed property comparison is not supported in this sandbox");',
  '    }',
  '    if (isDate(a) || isDate(b)) { return isDate(a) && isDate(b) && a.getTime() === b.getTime(); }',
  '    if (isRegExp(a) || isRegExp(b)) { return isRegExp(a) && isRegExp(b) && a.source === b.source && a.flags === b.flags; }',
  '    if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) { return false; }',
  '    var i;',
  '    for (i = 0; i < seen.length; i++) { if (seen[i][0] === a && seen[i][1] === b) { return true; } }',
  '    seen = seen.concat([[a, b]]);',
  '    var ak = ownKeys(a), bk = ownKeys(b);',
  '    if (ak.length !== bk.length) { return false; }',
  '    for (i = 0; i < ak.length; i++) {',
  '      if (ak[i] !== bk[i]) { return false; }',
  '      if (!deepEqual(a[ak[i]], b[bk[i]], strict, seen)) { return false; }',
  '    }',
  '    return true;',
  '  }',
  '',
  '  function AssertionError(opts) {',
  '    opts = opts || {};',
  '    var instance = new Error(opts.message || "Assertion failed");',
  '    instance.name = "AssertionError";',
  '    instance.actual = opts.actual;',
  '    instance.expected = opts.expected;',
  '    instance.operator = opts.operator;',
  '    if (Object.setPrototypeOf) { Object.setPrototypeOf(instance, AssertionError.prototype); }',
  '    return instance;',
  '  }',
  '  AssertionError.prototype = Object.create(Error.prototype);',
  '  AssertionError.prototype.constructor = AssertionError;',
  '',
  '  function ok(value, message) {',
  '    if (!value) { throw AssertionError({ actual: value, expected: true, operator: "==", message: message || (String(value) + " == true") }); }',
  '  }',
  '  function equal(a, b, message) { if (!(a == b)) { throw AssertionError({ actual: a, expected: b, operator: "==", message: message }); } }',
  '  function notEqual(a, b, message) { if (a == b) { throw AssertionError({ actual: a, expected: b, operator: "!=", message: message }); } }',
  '  function strictEqual(a, b, message) { if (!(a === b)) { throw AssertionError({ actual: a, expected: b, operator: "strictEqual", message: message }); } }',
  '  function notStrictEqual(a, b, message) { if (a === b) { throw AssertionError({ actual: a, expected: b, operator: "notStrictEqual", message: message }); } }',
  '  function deepEqualFn(a, b, message) { if (!deepEqual(a, b, false, [])) { throw AssertionError({ actual: a, expected: b, operator: "deepEqual", message: message }); } }',
  '  function notDeepEqualFn(a, b, message) { if (deepEqual(a, b, false, [])) { throw AssertionError({ actual: a, expected: b, operator: "notDeepEqual", message: message }); } }',
  '  function deepStrictEqualFn(a, b, message) { if (!deepEqual(a, b, true, [])) { throw AssertionError({ actual: a, expected: b, operator: "deepStrictEqual", message: message }); } }',
  '  function notDeepStrictEqualFn(a, b, message) { if (deepEqual(a, b, true, [])) { throw AssertionError({ actual: a, expected: b, operator: "notDeepStrictEqual", message: message }); } }',
  '  function ifError(value) { if (value !== null && value !== undefined) { throw value; } }',
  '  function failFn() {',
  '    if (arguments.length <= 1) { throw AssertionError({ message: arguments[0] || "Failed", operator: "fail" }); }',
  '    throw AssertionError({ actual: arguments[0], expected: arguments[1], message: arguments[2], operator: arguments[3] || "fail" });',
  '  }',
  '',
  '  function isErrorCtor(fn) {',
  '    try { return fn === Error || (fn.prototype instanceof Error); } catch (e) { return false; }',
  '  }',
  '  function matchesExpected(actualErr, expected) {',
  '    if (expected === undefined) { return true; }',
  '    if (isRegExp(expected)) { return expected.test(actualErr && actualErr.message); }',
  '    if (typeof expected === "function") {',
  '      if (isErrorCtor(expected)) { return actualErr instanceof expected; }',
  '      return !!expected(actualErr);',
  '    }',
  '    if (typeof expected === "object" && expected !== null) {',
  '      var keys = ownKeys(expected), i;',
  '      for (i = 0; i < keys.length; i++) {',
  '        if (!deepEqual(actualErr[keys[i]], expected[keys[i]], false, [])) { return false; }',
  '      }',
  '      return true;',
  '    }',
  '    return false;',
  '  }',
  '  function throwsImpl(shouldThrow, fn, expected, message) {',
  '    var threw = false, thrown;',
  '    try { fn(); } catch (e) { threw = true; thrown = e; }',
  '    if (shouldThrow) {',
  '      if (!threw) { throw AssertionError({ message: message || "Missing expected exception.", operator: "throws" }); }',
  '      if (!matchesExpected(thrown, expected)) {',
  '        throw AssertionError({ actual: thrown, expected: expected, operator: "throws", message: message || "The thrown value did not match the expected error." });',
  '      }',
  '    } else if (threw) {',
  '      throw AssertionError({ message: message || "Got unwanted exception.", actual: thrown, operator: "doesNotThrow" });',
  '    }',
  '  }',
  '  function throwsFn(fn, expected, message) {',
  '    if (typeof expected === "string" && message === undefined) { message = expected; expected = undefined; }',
  '    throwsImpl(true, fn, expected, message);',
  '  }',
  '  function doesNotThrow(fn, expected, message) {',
  '    if (typeof expected === "string" && message === undefined) { message = expected; expected = undefined; }',
  '    throwsImpl(false, fn, expected, message);',
  '  }',
  '',
  '  function assertFn(value, message) { ok(value, message); }',
  '  assertFn.ok = ok;',
  '  assertFn.equal = equal;',
  '  assertFn.notEqual = notEqual;',
  '  assertFn.strictEqual = strictEqual;',
  '  assertFn.notStrictEqual = notStrictEqual;',
  '  assertFn.deepEqual = deepEqualFn;',
  '  assertFn.notDeepEqual = notDeepEqualFn;',
  '  assertFn.deepStrictEqual = deepStrictEqualFn;',
  '  assertFn.notDeepStrictEqual = notDeepStrictEqualFn;',
  '  assertFn.throws = throwsFn;',
  '  assertFn.doesNotThrow = doesNotThrow;',
  '  assertFn.ifError = ifError;',
  '  assertFn.fail = failFn;',
  '  assertFn.AssertionError = AssertionError;',
  '',
  '  function strictAssertFn(value, message) { ok(value, message); }',
  '  strictAssertFn.ok = ok;',
  '  strictAssertFn.equal = strictEqual;',
  '  strictAssertFn.notEqual = notStrictEqual;',
  '  strictAssertFn.strictEqual = strictEqual;',
  '  strictAssertFn.notStrictEqual = notStrictEqual;',
  '  strictAssertFn.deepEqual = deepStrictEqualFn;',
  '  strictAssertFn.notDeepEqual = notDeepStrictEqualFn;',
  '  strictAssertFn.deepStrictEqual = deepStrictEqualFn;',
  '  strictAssertFn.notDeepStrictEqual = notDeepStrictEqualFn;',
  '  strictAssertFn.throws = throwsFn;',
  '  strictAssertFn.doesNotThrow = doesNotThrow;',
  '  strictAssertFn.ifError = ifError;',
  '  strictAssertFn.fail = failFn;',
  '  strictAssertFn.AssertionError = AssertionError;',
  '  strictAssertFn.strict = strictAssertFn;',
  '  assertFn.strict = strictAssertFn;',
  '',
  '  return assertFn;',
  '}',
].join('\n');

/** Every module the sandbox can serve. Grown deliberately, one vetted entry at a time (M2/M3). */
export const SANDBOX_MODULES: SandboxModuleDefinition[] = [
  { name: 'path', aliases: ['node:path'], factorySource: PATH_FACTORY },
  { name: 'crypto', aliases: ['node:crypto'], factorySource: CRYPTO_FACTORY },
  { name: 'events', aliases: ['node:events'], factorySource: EVENTS_FACTORY },
  { name: 'assert', aliases: ['node:assert'], factorySource: ASSERT_FACTORY },
  // Vetted npm libraries (M3), bundled + pinned by scripts/generate-sandbox-vendored.ts. Heavy, so
  // only included in the eval'd registry source when a plugin declares them.
  { name: 'uuid', factorySource: UUID_FACTORY_SOURCE, heavy: true },
  { name: 'ajv', factorySource: AJV_FACTORY_SOURCE, heavy: true },
];

/** Pinned versions of the vendored libs — asserted by tests so a regeneration is a deliberate diff. */
export const VENDORED_LIB_VERSIONS: Record<string, string> = {
  uuid: UUID_FACTORY_VERSION,
  ajv: AJV_FACTORY_VERSION,
};

/**
 * The floor of module access every template-tag plugin receives, even with no manifest. The
 * effective grant is `baseline ∪ manifest.modules` (see `resolveTemplateTagModules`): module grants
 * are NOT intersected with a surface ceiling at resolve time — the registry + `__require` are the
 * gate (an unregistered declared name has no factory, so it grants nothing regardless). Capability
 * grants, by contrast, do enforce the P1 profile ceiling.
 */
export const TEMPLATE_TAG_BASELINE_MODULES: string[] = ['path', 'crypto'];

/** Every registered module name — the trusted grant for first-party bundle plugins. */
export const ALL_SANDBOX_MODULES: string[] = SANDBOX_MODULES.map(m => m.name);

// alias -> canonical (e.g. "node:events" -> "events"); a Map so keys like "__proto__" stay literal.
const canonicalModuleName = new Map<string, string>(
  SANDBOX_MODULES.flatMap(m => [[m.name, m.name], ...(m.aliases ?? []).map(a => [a, m.name] as [string, string])]),
);

/** Resolve a declared module specifier to its canonical registry name (e.g. `node:events` → `events`). */
export const canonicalizeModule = (name: string): string => canonicalModuleName.get(name) ?? name;

const registerCall = (m: SandboxModuleDefinition): string => {
  // name/aliases are JSON-encoded (data); factorySource is interpolated raw (code), so it must be
  // a trusted literal — see SandboxModuleDefinition.factorySource. Tripwire: reject anything that
  // isn't a bare function expression, catching accidental non-literal/derived sources.
  if (!/^function\b/.test(m.factorySource.trim())) {
    throw new Error(`Sandbox module '${m.name}' factorySource must be a function expression`);
  }
  return `globalThis.__registerModule(${JSON.stringify(m.name)}, ${JSON.stringify(m.aliases ?? [])}, ${m.factorySource});`;
};

/**
 * JS evaluated inside the sandbox immediately after the bootstrap to populate the registry that
 * `__require` resolves from. Non-heavy modules are always registered; a heavy vendored lib (uuid,
 * ajv) is included only when the plugin's grant names it, so a render that doesn't use it never
 * parses its (hundreds of KB) bundle. `grantedModules` are canonical names from the envelope.
 */
export const buildModuleRegistrySource = (grantedModules: string[] = []): string => {
  const granted = new Set(grantedModules);
  return [
    '(function(){',
    // Capture then drop sandbox-globals.ts's hand-off object — this IIFE runs synchronously, once,
    // before any plugin code (RUNNER evaluates last), so there's no window where a plugin could ever
    // observe globalThis.__nodeCryptoExports as a bare global. CRYPTO_FACTORY closes over this local
    // instead, so it stays available whenever require('crypto') is first (lazily) called.
    '  var __cryptoExportsCapture = globalThis.__nodeCryptoExports;',
    '  delete globalThis.__nodeCryptoExports;',
    ...SANDBOX_MODULES.filter(m => !m.heavy || granted.has(m.name)).map(registerCall),
    // Lock the registry once populated — plugin code must not be able to register or replace factories.
    '  delete globalThis.__registerModule;',
    '})();',
  ].join('\n');
};
