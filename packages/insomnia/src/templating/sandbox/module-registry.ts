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

// A pure-JS `querystring` reimplementation. `parse()` returns an `Object.create(null)` result (like
// real Node) so a crafted key of "__proto__" is just an own data property, never triggers the
// Object.prototype accessor — no prototype-pollution path through parsed query keys. `unescape()`
// falls back to the input value unchanged if it contains any malformed percent-encoding; real Node
// partially decodes valid escapes and passes through only the invalid segment, which this shim does
// not replicate (documented in PERMISSIONS.md). `parse()`'s own per-key/value decode (`decodeQSValue`)
// has the identical all-or-nothing fallback, scoped to the individual key or value token rather than
// the whole query string: a malformed escape anywhere in one key/value leaves that whole token
// undecoded, including any well-formed escapes elsewhere in the same token, where real Node would
// still decode them (also documented in PERMISSIONS.md).
const QUERYSTRING_FACTORY = [
  'function () {',
  '  function isFiniteNumber(v) { return typeof v === "number" && v === v && v !== Infinity && v !== -Infinity; }',
  '  function stringifyPrimitive(v) {',
  '    if (typeof v === "string") { return v; }',
  '    if (isFiniteNumber(v)) { return String(v); }',
  '    if (typeof v === "boolean") { return String(v); }',
  '    return "";',
  '  }',
  '  function encodeQS(s) { return encodeURIComponent(String(s)); }',
  '  function decodeQSValue(s) {',
  '    s = String(s).replace(/\\+/g, " ");',
  '    try { return decodeURIComponent(s); } catch (e) { return s; }',
  '  }',
  '',
  '  function parse(str, sep, eq, options) {',
  '    str = str === undefined || str === null ? "" : String(str);',
  '    sep = sep === undefined || sep === null ? "&" : sep;',
  '    eq = eq === undefined || eq === null ? "=" : eq;',
  '    var maxKeys = 1000;',
  '    if (options && typeof options.maxKeys === "number") { maxKeys = options.maxKeys; }',
  '    var result = Object.create(null);',
  '    if (str.length === 0) { return result; }',
  '    var pairs = str.split(sep);',
  '    if (maxKeys > 0 && pairs.length > maxKeys) { pairs = pairs.slice(0, maxKeys); }',
  '    var i, pair, eqIdx, key, val;',
  '    for (i = 0; i < pairs.length; i++) {',
  '      pair = pairs[i];',
  '      if (pair.length === 0) { continue; }',
  '      eqIdx = pair.indexOf(eq);',
  '      if (eqIdx === -1) { key = decodeQSValue(pair); val = ""; } else {',
  '        key = decodeQSValue(pair.slice(0, eqIdx));',
  '        val = decodeQSValue(pair.slice(eqIdx + eq.length));',
  '      }',
  '      if (key in result) {',
  '        if (Array.isArray(result[key])) { result[key].push(val); } else { result[key] = [result[key], val]; }',
  '      } else {',
  '        result[key] = val;',
  '      }',
  '    }',
  '    return result;',
  '  }',
  '',
  '  function stringify(obj, sep, eq, options) {',
  '    sep = sep === undefined || sep === null ? "&" : sep;',
  '    eq = eq === undefined || eq === null ? "=" : eq;',
  '    obj = obj || {};',
  '    var parts = [];',
  '    var keys = Object.keys(obj);',
  '    var i, j, key, value;',
  '    for (i = 0; i < keys.length; i++) {',
  '      key = keys[i];',
  '      value = obj[key];',
  '      if (Array.isArray(value)) {',
  '        for (j = 0; j < value.length; j++) { parts.push(encodeQS(key) + eq + encodeQS(stringifyPrimitive(value[j]))); }',
  '      } else {',
  '        parts.push(encodeQS(key) + eq + encodeQS(stringifyPrimitive(value)));',
  '      }',
  '    }',
  '    return parts.join(sep);',
  '  }',
  '',
  '  function escapeFn(str) { return encodeURIComponent(String(str)); }',
  '  function unescapeFn(str) {',
  '    str = String(str);',
  '    try { return decodeURIComponent(str); } catch (e) { return str; }',
  '  }',
  '',
  '  return { parse: parse, stringify: stringify, decode: parse, encode: stringify, escape: escapeFn, unescape: unescapeFn };',
  '}',
].join('\n');

/** Every module the sandbox can serve. Grown deliberately, one vetted entry at a time (M2/M3). */
export const SANDBOX_MODULES: SandboxModuleDefinition[] = [
  { name: 'path', aliases: ['node:path'], factorySource: PATH_FACTORY },
  { name: 'crypto', aliases: ['node:crypto'], factorySource: CRYPTO_FACTORY },
  { name: 'events', aliases: ['node:events'], factorySource: EVENTS_FACTORY },
  { name: 'querystring', aliases: ['node:querystring'], factorySource: QUERYSTRING_FACTORY },
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
