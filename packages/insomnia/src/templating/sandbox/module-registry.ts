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

export interface SandboxModuleDefinition {
  /** Canonical registry name — also the name a plugin manifest will declare (C3). */
  name: string;
  /** Alternate request specifiers that resolve to this module (e.g. the `node:` prefixed form). */
  aliases?: string[];
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
// return values inline — matching node:crypto's synchronous contract.
const CRYPTO_FACTORY = [
  'function () {',
  '  if (typeof globalThis.__cryptoHash !== "function") { throw new Error("\'crypto\' is not available in this sandbox"); }',
  '  var mkDigester = function (compute) {',
  '    var parts = [];',
  '    var obj = {',
  '      update: function (data) { parts.push(typeof data === "string" ? data : String(data)); return obj; },',
  '      digest: function (enc) { return compute(parts.join(""), enc || "hex"); }',
  '    };',
  '    return obj;',
  '  };',
  '  return {',
  '    createHash: function (algo) { return mkDigester(function (data, enc) { return globalThis.__cryptoHash(algo, data, "utf8", enc); }); },',
  '    createHmac: function (algo, key) { var k = typeof key === "string" ? key : String(key); return mkDigester(function (data, enc) { return globalThis.__cryptoHmac(algo, k, data, enc); }); },',
  '    randomBytes: function (size) {',
  '      var b64 = globalThis.__cryptoRandomBytes(size);',
  '      var binary = atob(b64);',
  '      return {',
  '        length: binary.length,',
  '        toString: function (enc) {',
  '          if (enc === "base64") { return b64; }',
  '          if (enc === "latin1" || enc === "binary") { return binary; }',
  '          var hex = ""; for (var i = 0; i < binary.length; i++) { hex += ("0" + binary.charCodeAt(i).toString(16)).slice(-2); } return hex;',
  '        }',
  '      };',
  '    },',
  '    randomUUID: function () { return globalThis.__cryptoRandomUUID(); }',
  '  };',
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

/** Every module the sandbox can serve. Grown deliberately, one vetted entry at a time (M2/M3). */
export const SANDBOX_MODULES: SandboxModuleDefinition[] = [
  { name: 'path', aliases: ['node:path'], factorySource: PATH_FACTORY },
  { name: 'crypto', aliases: ['node:crypto'], factorySource: CRYPTO_FACTORY },
  { name: 'events', aliases: ['node:events'], factorySource: EVENTS_FACTORY },
];

/**
 * The floor of module access every template-tag plugin receives, even with no manifest. Surface
 * profiles (P1) will intersect the resolved grant with a ceiling; for now the effective grant is
 * simply `baseline ∪ manifest.modules` (see `resolveTemplateTagModules`).
 */
export const TEMPLATE_TAG_BASELINE_MODULES: string[] = ['path', 'crypto'];

/** Every registered module name — the trusted grant for first-party bundle plugins. */
export const ALL_SANDBOX_MODULES: string[] = SANDBOX_MODULES.map(m => m.name);

/**
 * Resolve the module set a template-tag plugin may `require()`: the baseline floor plus whatever the
 * plugin declared in `insomnia.permissions.modules`. Unknown declared names are harmless here —
 * they simply fail at require time with "not available in sandbox" (parse and grant are separate
 * concerns). Profile-ceiling intersection is added in P1.
 */
// alias -> canonical (e.g. "node:events" -> "events"); a Map so keys like "__proto__" stay literal.
const canonicalModuleName = new Map<string, string>(
  SANDBOX_MODULES.flatMap(m => [[m.name, m.name], ...(m.aliases ?? []).map(a => [a, m.name] as [string, string])]),
);

export const resolveTemplateTagModules = (declaredModules: string[] = []): string[] => {
  const resolved = [...TEMPLATE_TAG_BASELINE_MODULES];
  for (const name of declaredModules) {
    const canonical = canonicalModuleName.get(name) ?? name;
    if (!resolved.includes(canonical)) {
      resolved.push(canonical);
    }
  }
  return resolved;
};

/**
 * JS evaluated inside the sandbox immediately after the bootstrap. Populates the registry the
 * bootstrap's `__require` resolves from.
 */
export const MODULE_REGISTRY_SOURCE: string = [
  ...SANDBOX_MODULES.map(m => {
    // name/aliases are JSON-encoded (data); factorySource is interpolated raw (code), so it must be
    // a trusted literal — see SandboxModuleDefinition.factorySource. Tripwire: reject anything that
    // isn't a bare function expression, catching accidental non-literal/derived sources.
    if (!/^function\b/.test(m.factorySource.trim())) {
      throw new Error(`Sandbox module '${m.name}' factorySource must be a function expression`);
    }
    return `globalThis.__registerModule(${JSON.stringify(m.name)}, ${JSON.stringify(m.aliases ?? [])}, ${m.factorySource});`;
  }),
  // Lock the registry once populated — plugin code must not be able to register or replace factories.
  'delete globalThis.__registerModule;',
].join('\n');
