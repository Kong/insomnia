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

// A thin adapter over the ambient URL/URLSearchParams globals (sandbox-globals.ts, M2) plus a
// legacy parse()/format() shim matching node:url's deprecated (but still widely used by ported
// plugins) API. parse()/format() are independent, self-contained implementations — they do not
// reuse URL/URLSearchParams' own authority-parsing internals, so the two known gaps below are
// deliberate, not accidental:
//   - Legacy hostname/port parsing here handles a bracketed IPv6 literal correctly (hostname stored
//     without brackets, e.g. "::1", matching node:url.parse — WHATWG's URL keeps the brackets in
//     .hostname instead, a different, equally-real convention for a different API).
//   - Unlike real Node, a literal backslash is never treated as a path/host delimiter or as a
//     stand-in for "//" after the protocol. Real Node's legacy parser does this for historical
//     browser-compat reasons, and it's exactly the parsing-confusion behavior Node's own deprecation
//     notice on url.parse cites as having "security implications" — intentionally not replicated.
// Verified against node:url for every specifier/edge case exercised by url.regression.test.ts.
// parse() strips leading/trailing C0-control-or-space bytes before parsing, matching the WHATWG URL
// Standard's own input-trimming step that node:url's legacy parser also implements — this is an
// edge-only strip; a control byte elsewhere in the string is left in place. The unsafe-character
// escaping table (space/single+double-quote/angle-brackets/backtick/caret/pipe/braces) matches
// node:url's own table; a C0 control byte that survives the edge strip is additionally
// percent-escaped here even where real Node leaves it raw — a deliberately more conservative,
// safe-direction difference, not a parity gap. slashesDenoteHost's rarer host-detection quirks
// beyond the tested cases are not guaranteed byte-for-byte.
const URL_FACTORY = [
  'function () {',
  '  var URLCtor = globalThis.URL;',
  '  var USPCtor = globalThis.URLSearchParams;',
  '  var SLASHED_PROTOCOLS = { http: true, https: true, ftp: true, gopher: true, file: true, ws: true, wss: true };',
  '  var HOSTLESS_PROTOCOLS = { javascript: true };',
  '  var UNSAFE_CHAR_ESCAPES = {};',
  '  UNSAFE_CHAR_ESCAPES[" "] = "%20";',
  '  UNSAFE_CHAR_ESCAPES[String.fromCharCode(34)] = "%22";',
  '  UNSAFE_CHAR_ESCAPES[String.fromCharCode(39)] = "%27";',
  '  UNSAFE_CHAR_ESCAPES["<"] = "%3C";',
  '  UNSAFE_CHAR_ESCAPES[">"] = "%3E";',
  '  UNSAFE_CHAR_ESCAPES["`"] = "%60";',
  '  UNSAFE_CHAR_ESCAPES["^"] = "%5E";',
  '  UNSAFE_CHAR_ESCAPES["|"] = "%7C";',
  '  UNSAFE_CHAR_ESCAPES["{"] = "%7B";',
  '  UNSAFE_CHAR_ESCAPES["}"] = "%7D";',
  '  function escapeUnsafe(s) {',
  '    var out = "";',
  '    for (var i = 0; i < s.length; i++) {',
  '      var ch = s.charAt(i);',
  '      var code = s.charCodeAt(i);',
  '      if (code <= 31) { out += "%" + ("0" + code.toString(16).toUpperCase()).slice(-2); }',
  '      else if (UNSAFE_CHAR_ESCAPES[ch]) { out += UNSAFE_CHAR_ESCAPES[ch]; }',
  '      else { out += ch; }',
  '    }',
  '    return out;',
  '  }',
  '  function qsEnc(s) { return encodeURIComponent(s).replace(/%20/g, "+"); }',
  '  function parseQS(str) {',
  '    var obj = {};',
  '    new USPCtor(str).forEach(function (v, k) {',
  '      if (Object.prototype.hasOwnProperty.call(obj, k)) {',
  '        if (Object.prototype.toString.call(obj[k]) === "[object Array]") { obj[k].push(v); }',
  '        else { obj[k] = [obj[k], v]; }',
  '      } else { obj[k] = v; }',
  '    });',
  '    return obj;',
  '  }',
  '  function stringifyQS(q) {',
  '    var parts = [];',
  '    for (var k in q) {',
  '      if (!Object.prototype.hasOwnProperty.call(q, k)) { continue; }',
  '      var v = q[k];',
  '      if (Object.prototype.toString.call(v) === "[object Array]") {',
  '        for (var i = 0; i < v.length; i++) { parts.push(qsEnc(k) + "=" + qsEnc(String(v[i]))); }',
  '      } else { parts.push(qsEnc(k) + "=" + qsEnc(String(v))); }',
  '    }',
  '    return parts.join("&");',
  '  }',
  '  function splitPathQueryHash(rest, parseQueryString) {',
  '    var hash = null, search = null, query = parseQueryString ? {} : null;',
  '    var hIdx = rest.indexOf("#");',
  '    if (hIdx !== -1) { hash = escapeUnsafe(rest.slice(hIdx)); rest = rest.slice(0, hIdx); }',
  '    var qIdx = rest.indexOf("?");',
  '    if (qIdx !== -1) {',
  '      var rawQuery = rest.slice(qIdx + 1);',
  '      search = "?" + escapeUnsafe(rawQuery);',
  '      rest = rest.slice(0, qIdx);',
  '      query = parseQueryString ? parseQS(rawQuery) : escapeUnsafe(rawQuery);',
  '    }',
  '    var pathname = rest === "" ? null : escapeUnsafe(rest);',
  '    return { pathname: pathname, search: search, query: query, hash: hash };',
  '  }',
  // auth is text before the last "@"; port is the digits after the LAST colon in the (post-auth)
  // candidate, but only if that trailing segment is non-empty digits; hostname is the text before
  // the FIRST colon; anything between the first and last colon when a valid port is found (or from
  // the first colon onward when it isn't) is not part of the host and is pushed back into leftover
  // text that becomes part of the path. A bracketed IPv6 literal is handled as its own case first.
  '  function parseAuthority(candidate) {',
  '    var auth = null;',
  '    var at = candidate.lastIndexOf("@");',
  '    if (at !== -1) { auth = candidate.slice(0, at); candidate = candidate.slice(at + 1); }',
  '    var hostname = null, port = null, leftover = "";',
  '    if (candidate.charAt(0) === "[") {',
  '      var closeBracket = candidate.indexOf("]");',
  '      if (closeBracket !== -1) {',
  '        hostname = candidate.slice(1, closeBracket).toLowerCase();',
  '        var afterBracket = candidate.slice(closeBracket + 1);',
  '        if (afterBracket.charAt(0) === ":") {',
  '          var portCandidate = afterBracket.slice(1);',
  '          if (/^\\d+$/.test(portCandidate)) { port = portCandidate; } else { leftover = afterBracket; }',
  '        } else if (afterBracket !== "") { leftover = afterBracket; }',
  '        return { auth: auth, hostname: hostname, port: port, leftover: leftover };',
  '      }',
  '    }',
  '    var firstColon = candidate.indexOf(":");',
  '    if (firstColon === -1) {',
  '      hostname = candidate.toLowerCase();',
  '    } else {',
  '      var lastColon = candidate.lastIndexOf(":");',
  '      var portCandidate2 = candidate.slice(lastColon + 1);',
  '      if (/^\\d+$/.test(portCandidate2)) {',
  '        hostname = candidate.slice(0, firstColon).toLowerCase();',
  '        port = portCandidate2;',
  '        leftover = candidate.slice(firstColon, lastColon);',
  '      } else {',
  '        hostname = candidate.slice(0, firstColon).toLowerCase();',
  '        leftover = candidate.slice(firstColon);',
  '      }',
  '    }',
  '    return { auth: auth, hostname: hostname, port: port, leftover: leftover };',
  '  }',
  '  function buildHost(hostname, port) {',
  '    if (hostname === null) { return null; }',
  '    var h = hostname.indexOf(":") !== -1 ? "[" + hostname + "]" : hostname;',
  '    return port !== null ? h + ":" + port : h;',
  '  }',
  '  function parseAuthorityChunk(rest) {',
  '    var end = rest.search(/[/?#]/);',
  '    var candidate = end === -1 ? rest : rest.slice(0, end);',
  '    var tail = end === -1 ? "" : rest.slice(end);',
  '    var a = parseAuthority(candidate);',
  '    var newRest = a.leftover + tail;',
  '    if (newRest !== "" && newRest.charAt(0) !== "/" && newRest.charAt(0) !== "?" && newRest.charAt(0) !== "#") {',
  '      newRest = "/" + newRest;',
  '    }',
  '    return { auth: a.auth, hostname: a.hostname, port: a.port, rest: newRest };',
  '  }',
  '  function parse(urlString, parseQueryString, slashesDenoteHost) {',
  '    var input = String(urlString).replace(/^[\\x00-\\x20]+/, "").replace(/[\\x00-\\x20]+$/, "");',
  '    var protocol = null, slashes = null, auth = null, hostname = null, port = null;',
  '    var rest = input;',
  '    var pm = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(input);',
  '    if (pm) {',
  '      protocol = pm[1].toLowerCase() + ":";',
  '      rest = input.slice(pm[0].length);',
  '      var protoName = pm[1].toLowerCase();',
  '      if (HOSTLESS_PROTOCOLS[protoName]) {',
  '        // never parses host, even when "//" is literally present.',
  '      } else if (rest.slice(0, 2) === "//") {',
  '        slashes = true;',
  '        var chunk = parseAuthorityChunk(rest.slice(2));',
  '        auth = chunk.auth; hostname = chunk.hostname; port = chunk.port; rest = chunk.rest;',
  '      } else if (SLASHED_PROTOCOLS[protoName]) {',
  '        // no host parsing without "//"; rest stays as-is (pathname/search/hash split still applies).',
  '      } else {',
  '        var chunk2 = parseAuthorityChunk(rest);',
  '        auth = chunk2.auth; hostname = chunk2.hostname; port = chunk2.port; rest = chunk2.rest;',
  '      }',
  '    } else if (rest.slice(0, 2) === "//" && slashesDenoteHost) {',
  '      slashes = true;',
  '      var chunk3 = parseAuthorityChunk(rest.slice(2));',
  '      auth = chunk3.auth; hostname = chunk3.hostname; port = chunk3.port; rest = chunk3.rest;',
  '    }',
  '    var host = buildHost(hostname, port);',
  '    var split = splitPathQueryHash(rest, !!parseQueryString);',
  '    if (slashes && hostname !== null && hostname !== "" && split.pathname === null) { split.pathname = "/"; }',
  '    var href = (protocol || "") + (slashes ? "//" : "") + (auth ? auth + "@" : "") + (host || "") +',
  '      (split.pathname || "") + (split.search || "") + (split.hash || "");',
  '    return {',
  '      protocol: protocol, slashes: slashes, auth: auth, host: host, port: port, hostname: hostname,',
  '      hash: split.hash, search: split.search, query: split.query, pathname: split.pathname,',
  '      path: split.pathname !== null || split.search !== null ? (split.pathname || "") + (split.search || "") : null,',
  '      href: href',
  '    };',
  '  }',
  '  function format(obj) {',
  '    if (obj != null && typeof obj === "object" && obj instanceof URLCtor) { return String(obj.href); }',
  '    if (typeof obj === "string") { return format(parse(obj, false, false)); }',
  '    var proto = obj.protocol || "";',
  '    if (proto && proto.charAt(proto.length - 1) !== ":") { proto += ":"; }',
  '    var protoName = proto.replace(/:$/, "").toLowerCase();',
  '    var hasSlashes;',
  '    if (typeof obj.slashes === "boolean") { hasSlashes = obj.slashes; }',
  '    else { hasSlashes = !!(SLASHED_PROTOCOLS[protoName] && (obj.host || obj.hostname)); }',
  '    var hostPart = obj.host || buildHost(obj.hostname || null, obj.port || null) || "";',
  '    var qs = "";',
  '    if (obj.search) {',
  '      qs = String(obj.search);',
  '      if (qs.charAt(0) !== "?") { qs = "?" + qs; }',
  '    } else if (obj.query != null) {',
  '      if (typeof obj.query === "object" && Object.prototype.toString.call(obj.query) !== "[object Array]") {',
  '        var s = stringifyQS(obj.query);',
  '        if (s) { qs = "?" + s; }',
  '      } else if (obj.query !== "") { qs = "?" + String(obj.query); }',
  '    }',
  '    var hash = obj.hash ? (String(obj.hash).charAt(0) === "#" ? String(obj.hash) : "#" + String(obj.hash)) : "";',
  '    var auth = obj.auth ? String(obj.auth) + "@" : "";',
  '    var pathname = obj.pathname || "";',
  '    return proto + (hasSlashes ? "//" : "") + auth + hostPart + pathname + qs + hash;',
  '  }',
  '  return { parse: parse, format: format, URL: URLCtor, URLSearchParams: USPCtor };',
  '}',
].join('\n');

/** Every module the sandbox can serve. Grown deliberately, one vetted entry at a time (M2/M3). */
export const SANDBOX_MODULES: SandboxModuleDefinition[] = [
  { name: 'path', aliases: ['node:path'], factorySource: PATH_FACTORY },
  { name: 'crypto', aliases: ['node:crypto'], factorySource: CRYPTO_FACTORY },
  { name: 'events', aliases: ['node:events'], factorySource: EVENTS_FACTORY },
  { name: 'url', aliases: ['node:url'], factorySource: URL_FACTORY },
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
