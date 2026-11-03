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

// Reduced, documented replacement for node:util — only `format`, `promisify`, and `types.is*` are
// ported (PERMISSIONS.md records the exclusions: no `inspect`/`inherits`/`deprecate`, and %o is not
// distinguished from %O — no showHidden/proxy/unbounded-depth inspection). `format`'s object/array
// rendering and quote-character selection were verified line-for-line against real node:util's
// output (including the %s-vs-%O/extra-arg divergence in how each treats strings and functions, and
// the -0/bigint/symbol coercion quirks of %d/%i/%f) before transcription here.
const UTIL_FACTORY = [
  'function () {',
  '  function isValidIdentifierKey(k) { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k); }',
  '  function quoteString(s) {',
  '    if (s.indexOf("\'") === -1) { return "\'" + s + "\'"; }',
  '    if (s.indexOf(\'"\') === -1) { return \'"\' + s + \'"\'; }',
  '    if (s.indexOf("`") === -1) { return "`" + s + "`"; }',
  '    var bs = String.fromCharCode(92);',
  '    return "\'" + s.split("\'").join(bs + "\'") + "\'";',
  '  }',
  '  function formatKey(k) { return isValidIdentifierKey(k) ? k : quoteString(k); }',
  '  function formatNumber(n) {',
  '    if (n === 0 && 1 / n === -Infinity) { return "-0"; }',
  '    return String(n);',
  '  }',
  '  function formatPrimitiveNonString(v) {',
  '    if (v === undefined) { return "undefined"; }',
  '    var t = typeof v;',
  '    if (t === "boolean") { return v ? "true" : "false"; }',
  '    if (t === "bigint") { return String(v) + "n"; }',
  '    if (t === "number") { return formatNumber(v); }',
  '    return String(v);',
  '  }',
  '  function inspect(v, maxDepth) {',
  '    if (v === null) { return "null"; }',
  '    var t = typeof v;',
  '    if (t === "string") { return quoteString(v); }',
  '    if (t === "function") { var nm = v.name; return nm ? "[Function: " + nm + "]" : "[Function (anonymous)]"; }',
  '    if (t !== "object") { return formatPrimitiveNonString(v); }',
  '    return inspectContainer(v, 0, maxDepth);',
  '  }',
  '  function inspectContainer(v, depth, maxDepth) {',
  '    if (depth > maxDepth) { return Array.isArray(v) ? "[Array]" : "[Object]"; }',
  '    if (Array.isArray(v)) {',
  '      if (v.length === 0) { return "[]"; }',
  '      var parts = [];',
  '      for (var i = 0; i < v.length; i++) { parts.push(inspectNested(v[i], depth + 1, maxDepth)); }',
  '      return "[ " + parts.join(", ") + " ]";',
  '    }',
  '    var keys = Object.keys(v);',
  '    if (keys.length === 0) { return "{}"; }',
  '    var oparts = [];',
  '    for (var j = 0; j < keys.length; j++) {',
  '      var key = keys[j];',
  '      oparts.push(formatKey(key) + ": " + inspectNested(v[key], depth + 1, maxDepth));',
  '    }',
  '    return "{ " + oparts.join(", ") + " }";',
  '  }',
  '  function inspectNested(v, depth, maxDepth) {',
  '    if (v === null) { return "null"; }',
  '    var t = typeof v;',
  '    if (t === "string") { return quoteString(v); }',
  '    if (t === "function") { var nm = v.name; return nm ? "[Function: " + nm + "]" : "[Function (anonymous)]"; }',
  '    if (t !== "object") { return formatPrimitiveNonString(v); }',
  '    return inspectContainer(v, depth, maxDepth);',
  '  }',
  '  function formatS(v) {',
  '    if (typeof v === "bigint") { return String(v) + "n"; }',
  '    if (typeof v === "number") { return formatNumber(v); }',
  '    if (typeof v !== "object" || v === null) { return String(v); }',
  '    return inspect(v, 0);',
  '  }',
  '  function formatFull(v) { return inspect(v, 2); }',
  '  function formatJoin(v) { return typeof v === "string" ? v : formatFull(v); }',
  '  function fmtD(v) {',
  '    if (typeof v === "bigint") { return String(v) + "n"; }',
  '    if (typeof v === "symbol") { return "NaN"; }',
  '    return formatNumber(Number(v));',
  '  }',
  '  function fmtI(v) {',
  '    if (typeof v === "bigint") { return String(v) + "n"; }',
  '    if (typeof v === "symbol") { return "NaN"; }',
  '    return formatNumber(parseInt(v, 10));',
  '  }',
  '  function fmtF(v) {',
  '    if (typeof v === "symbol") { return "NaN"; }',
  '    return formatNumber(parseFloat(v));',
  '  }',
  '  function fmtJ(v) {',
  '    try {',
  '      var s = JSON.stringify(v);',
  '      return s === undefined ? "undefined" : s;',
  '    } catch (e) {',
  '      if (e && typeof e.message === "string" && e.message.indexOf("circular") !== -1) { return "[Circular]"; }',
  '      throw e;',
  '    }',
  '  }',
  '  function format() {',
  '    var args = Array.prototype.slice.call(arguments);',
  '    if (args.length === 0) { return ""; }',
  '    var first = args[0];',
  '    if (typeof first !== "string") {',
  '      var parts0 = [];',
  '      for (var k = 0; k < args.length; k++) { parts0.push(formatJoin(args[k])); }',
  '      return parts0.join(" ");',
  '    }',
  '    if (args.length === 1) { return first; }',
  '    var out = "";',
  '    var i = 0;',
  '    var argIndex = 1;',
  '    while (i < first.length) {',
  '      var ch = first.charAt(i);',
  '      if (ch === "%" && i + 1 < first.length) {',
  '        var spec = first.charAt(i + 1);',
  '        if (spec === "%") { out += "%"; i += 2; continue; }',
  '        if ("sdifjoOc".indexOf(spec) !== -1 && argIndex < args.length) {',
  '          var val = args[argIndex];',
  '          argIndex += 1;',
  '          if (spec === "s") { out += formatS(val); }',
  '          else if (spec === "d") { out += fmtD(val); }',
  '          else if (spec === "i") { out += fmtI(val); }',
  '          else if (spec === "f") { out += fmtF(val); }',
  '          else if (spec === "j") { out += fmtJ(val); }',
  '          else if (spec === "o" || spec === "O") { out += formatFull(val); }',
  '          i += 2;',
  '          continue;',
  '        }',
  '      }',
  '      out += ch;',
  '      i += 1;',
  '    }',
  '    for (; argIndex < args.length; argIndex++) { out += " " + formatJoin(args[argIndex]); }',
  '    return out;',
  '  }',
  '  var PROMISIFY_CUSTOM = Symbol.for("nodejs.util.promisify.custom");',
  '  function promisify(original) {',
  '    if (typeof original !== "function") { throw new TypeError("The \\"original\\" argument must be of type function"); }',
  '    if (original[PROMISIFY_CUSTOM]) { return original[PROMISIFY_CUSTOM]; }',
  '    function fn() {',
  '      var args = Array.prototype.slice.call(arguments);',
  '      var self = this;',
  '      return new Promise(function (resolve, reject) {',
  '        args.push(function (err) {',
  '          if (err) { reject(err); return; }',
  '          resolve(arguments.length > 1 ? arguments[1] : undefined);',
  '        });',
  '        original.apply(self, args);',
  '      });',
  '    }',
  '    return fn;',
  '  }',
  '  promisify.custom = PROMISIFY_CUSTOM;',
  '  var types = {',
  '    isDate: function (v) { return v instanceof Date; },',
  '    isRegExp: function (v) { return v instanceof RegExp; },',
  '    isPromise: function (v) { return v instanceof Promise; },',
  '    isMap: function (v) { return v instanceof Map; },',
  '    isSet: function (v) { return v instanceof Set; },',
  '    isWeakMap: function (v) { return v instanceof WeakMap; },',
  '    isWeakSet: function (v) { return v instanceof WeakSet; },',
  '    isArrayBuffer: function (v) { return v instanceof ArrayBuffer; },',
  '    isDataView: function (v) { return v instanceof DataView; },',
  '    isTypedArray: function (v) { return ArrayBuffer.isView(v) && !(v instanceof DataView); },',
  '    isNativeError: function (v) { return v instanceof Error; },',
  '    isBooleanObject: function (v) { return typeof v === "object" && v instanceof Boolean; },',
  '    isNumberObject: function (v) { return typeof v === "object" && v instanceof Number; },',
  '    isStringObject: function (v) { return typeof v === "object" && v instanceof String; },',
  '    isAsyncFunction: function (v) { return Object.prototype.toString.call(v) === "[object AsyncFunction]"; },',
  '    isGeneratorFunction: function (v) { return Object.prototype.toString.call(v) === "[object GeneratorFunction]"; }',
  '  };',
  '  return { format: format, promisify: promisify, types: types };',
  '}',
].join('\n');

/** Every module the sandbox can serve. Grown deliberately, one vetted entry at a time (M2/M3). */
export const SANDBOX_MODULES: SandboxModuleDefinition[] = [
  { name: 'path', aliases: ['node:path'], factorySource: PATH_FACTORY },
  { name: 'crypto', aliases: ['node:crypto'], factorySource: CRYPTO_FACTORY },
  { name: 'events', aliases: ['node:events'], factorySource: EVENTS_FACTORY },
  { name: 'util', aliases: ['node:util'], factorySource: UTIL_FACTORY },
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
