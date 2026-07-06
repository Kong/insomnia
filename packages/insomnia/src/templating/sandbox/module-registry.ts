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

/** Every module the sandbox can serve. Grown deliberately, one vetted entry at a time (M2/M3). */
export const SANDBOX_MODULES: SandboxModuleDefinition[] = [
  { name: 'path', aliases: ['node:path'], factorySource: PATH_FACTORY },
  { name: 'crypto', aliases: ['node:crypto'], factorySource: CRYPTO_FACTORY },
];

/**
 * The module grant every template-tag plugin receives today. This is the pre-manifest baseline —
 * once the manifest loader (C3) and surface profiles (P1) land, the effective grant becomes
 * `manifest ∩ profile` with this set as the template-tag profile's floor.
 */
export const TEMPLATE_TAG_BASELINE_MODULES: string[] = ['path', 'crypto'];

/**
 * JS evaluated inside the sandbox immediately after the bootstrap. Populates the registry the
 * bootstrap's `__require` resolves from.
 */
export const MODULE_REGISTRY_SOURCE: string = [
  ...SANDBOX_MODULES.map(
    m =>
      `globalThis.__registerModule(${JSON.stringify(m.name)}, ${JSON.stringify(m.aliases ?? [])}, ${m.factorySource});`,
  ),
  // Lock the registry once populated — plugin code must not be able to register or replace factories.
  'delete globalThis.__registerModule;',
].join('\n');
