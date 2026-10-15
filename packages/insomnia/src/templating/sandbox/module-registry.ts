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

// Splits a byte stream into complete JS strings without breaking apart multi-byte characters
// across write() boundaries — a leftover partial UTF-8/UTF-16LE/base64 unit from one write() is
// buffered and completed by the next. Ported from the same byte-boundary algorithm the real
// `string_decoder` module uses (verified line-for-line against it), operating on plain byte
// arrays instead of a live host Buffer — no host object reference crosses into the sandbox.
const STRING_DECODER_FACTORY = [
  'function () {',
  '  function normalizeEncoding(enc) {',
  '    if (enc === undefined || enc === null || enc === "") { return "utf8"; }',
  '    var e = String(enc).toLowerCase();',
  '    if (e === "utf8" || e === "utf-8") { return "utf8"; }',
  '    if (e === "ucs2" || e === "ucs-2" || e === "utf16le" || e === "utf-16le") { return "utf16le"; }',
  '    if (e === "latin1" || e === "binary") { return "latin1"; }',
  '    if (e === "base64" || e === "ascii" || e === "hex") { return e; }',
  '    throw new Error("Unknown encoding: " + enc);',
  '  }',
  '  function toByteArray(chunk) {',
  '    if (chunk === undefined || chunk === null) { return new Uint8Array(0); }',
  '    if (chunk instanceof Uint8Array) { return chunk; }',
  '    if (typeof chunk.length === "number") {',
  '      var out = new Uint8Array(chunk.length);',
  '      for (var i = 0; i < chunk.length; i++) { out[i] = chunk[i] & 255; }',
  '      return out;',
  '    }',
  '    throw new TypeError("The \\"buffer\\" argument must be a Buffer or Uint8Array");',
  '  }',
  '  function hexByte(b) { var h = b.toString(16); return h.length === 1 ? "0" + h : h; }',
  '  function copyInto(dst, dstStart, src, srcStart, srcEnd) {',
  '    for (var i = srcStart; i < srcEnd; i++) { dst[dstStart + (i - srcStart)] = src[i]; }',
  '  }',
  // Byte-level UTF-8 -> UTF-16 decoder (WHATWG algorithm): each malformed byte or invalid
  // continuation yields exactly one U+FFFD, matching how the host engine decodes Buffer/string
  // conversions, so behavior stays identical whether the input is well-formed or not.
  '  function utf8Decode(bytes, start, end) {',
  '    var out = "";',
  '    var codePoint = 0, bytesSeen = 0, bytesNeeded = 0, lowerBoundary = 0x80, upperBoundary = 0xBF;',
  '    var i = start;',
  '    while (i < end) {',
  '      var b = bytes[i];',
  '      if (bytesNeeded === 0) {',
  '        if (b <= 0x7F) { out += String.fromCharCode(b); i++; continue; }',
  '        if (b >= 0xC2 && b <= 0xDF) { bytesNeeded = 1; codePoint = b & 0x1F; i++; continue; }',
  '        if (b >= 0xE0 && b <= 0xEF) {',
  '          if (b === 0xE0) { lowerBoundary = 0xA0; }',
  '          if (b === 0xED) { upperBoundary = 0x9F; }',
  '          bytesNeeded = 2; codePoint = b & 0x0F; i++; continue;',
  '        }',
  '        if (b >= 0xF0 && b <= 0xF4) {',
  '          if (b === 0xF0) { lowerBoundary = 0x90; }',
  '          if (b === 0xF4) { upperBoundary = 0x8F; }',
  '          bytesNeeded = 3; codePoint = b & 0x07; i++; continue;',
  '        }',
  '        out += "\\ufffd"; i++; continue;',
  '      }',
  '      if (b < lowerBoundary || b > upperBoundary) {',
  '        codePoint = 0; bytesNeeded = 0; bytesSeen = 0; lowerBoundary = 0x80; upperBoundary = 0xBF;',
  '        out += "\\ufffd";',
  '        continue;',
  '      }',
  '      lowerBoundary = 0x80; upperBoundary = 0xBF;',
  '      codePoint = (codePoint << 6) | (b & 0x3F);',
  '      bytesSeen++; i++;',
  '      if (bytesSeen !== bytesNeeded) { continue; }',
  '      if (codePoint > 0xFFFF) {',
  '        var hi = 0xD800 + ((codePoint - 0x10000) >> 10);',
  '        var lo = 0xDC00 + ((codePoint - 0x10000) & 0x3FF);',
  '        out += String.fromCharCode(hi, lo);',
  '      } else {',
  '        out += String.fromCharCode(codePoint);',
  '      }',
  '      codePoint = 0; bytesNeeded = 0; bytesSeen = 0;',
  '    }',
  '    if (bytesNeeded !== 0) { out += "\\ufffd"; }',
  '    return out;',
  '  }',
  '  function utf16leDecode(bytes, start, end) {',
  '    var out = ""; var i = start;',
  '    while (i + 1 < end) { out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8)); i += 2; }',
  '    return out;',
  '  }',
  '  function base64Encode(bytes, start, end) {',
  '    var bin = ""; for (var i = start; i < end; i++) { bin += String.fromCharCode(bytes[i]); }',
  '    return btoa(bin);',
  '  }',
  '  function hexEncode(bytes, start, end) {',
  '    var h = ""; for (var i = start; i < end; i++) { h += hexByte(bytes[i]); } return h;',
  '  }',
  '  function latin1Encode(bytes, start, end) {',
  '    var s = ""; for (var i = start; i < end; i++) { s += String.fromCharCode(bytes[i] & 255); } return s;',
  '  }',
  '  function asciiEncode(bytes, start, end) {',
  '    var s = ""; for (var i = start; i < end; i++) { s += String.fromCharCode(bytes[i] & 0x7F); } return s;',
  '  }',
  '  function bytesToString(bytes, encoding, start, end) {',
  '    if (encoding === "utf8") { return utf8Decode(bytes, start, end); }',
  '    if (encoding === "utf16le") { return utf16leDecode(bytes, start, end); }',
  '    if (encoding === "latin1") { return latin1Encode(bytes, start, end); }',
  '    if (encoding === "ascii") { return asciiEncode(bytes, start, end); }',
  '    if (encoding === "hex") { return hexEncode(bytes, start, end); }',
  '    if (encoding === "base64") { return base64Encode(bytes, start, end); }',
  '    throw new Error("Unknown encoding: " + encoding);',
  '  }',
  '  function utf8CheckByte(byte) {',
  '    if (byte <= 0x7F) { return 0; }',
  '    else if ((byte >> 5) === 0x06) { return 2; }',
  '    else if ((byte >> 4) === 0x0E) { return 3; }',
  '    else if ((byte >> 3) === 0x1E) { return 4; }',
  '    return (byte >> 6) === 0x02 ? -1 : -2;',
  '  }',
  '  function utf8CheckIncomplete(self, buf, i) {',
  '    var j = buf.length - 1;',
  '    if (j < i) { return 0; }',
  '    var nb = utf8CheckByte(buf[j]);',
  '    if (nb >= 0) { if (nb > 0) { self.lastNeed = nb - 1; } return nb; }',
  '    if (--j < i || nb === -2) { return 0; }',
  '    nb = utf8CheckByte(buf[j]);',
  '    if (nb >= 0) { if (nb > 0) { self.lastNeed = nb - 2; } return nb; }',
  '    if (--j < i || nb === -2) { return 0; }',
  '    nb = utf8CheckByte(buf[j]);',
  '    if (nb >= 0) {',
  '      if (nb > 0) { if (nb === 2) { nb = 0; } else { self.lastNeed = nb - 3; } }',
  '      return nb;',
  '    }',
  '    return 0;',
  '  }',
  '  function utf8CheckExtraBytes(self, buf, p) {',
  '    if ((buf[0] & 0xC0) !== 0x80) { self.lastNeed = 0; return "\\ufffd"; }',
  '    if (self.lastNeed > 1 && buf.length > 1) {',
  '      if ((buf[1] & 0xC0) !== 0x80) { self.lastNeed = 1; return "\\ufffd"; }',
  '      if (self.lastNeed > 2 && buf.length > 2) {',
  '        if ((buf[2] & 0xC0) !== 0x80) { self.lastNeed = 2; return "\\ufffd"; }',
  '      }',
  '    }',
  '  }',
  '  function utf8FillLast(buf) {',
  '    var p = this.lastTotal - this.lastNeed;',
  '    var r = utf8CheckExtraBytes(this, buf, p);',
  '    if (r !== undefined) { return r; }',
  '    if (this.lastNeed <= buf.length) {',
  '      copyInto(this.lastChar, p, buf, 0, this.lastNeed);',
  '      return bytesToString(this.lastChar, "utf8", 0, this.lastTotal);',
  '    }',
  '    copyInto(this.lastChar, p, buf, 0, buf.length);',
  '    this.lastNeed -= buf.length;',
  '  }',
  '  function utf8Text(buf, i) {',
  '    var total = utf8CheckIncomplete(this, buf, i);',
  '    if (!this.lastNeed) { return bytesToString(buf, "utf8", i, buf.length); }',
  '    this.lastTotal = total;',
  '    var end = buf.length - (total - this.lastNeed);',
  '    copyInto(this.lastChar, 0, buf, end, buf.length);',
  '    return bytesToString(buf, "utf8", i, end);',
  '  }',
  '  function utf8End(buf) {',
  '    var r = (buf && buf.length) ? this.write(buf) : "";',
  '    if (this.lastNeed) { return r + "\\ufffd"; }',
  '    return r;',
  '  }',
  '  function utf16Text(buf, i) {',
  '    if ((buf.length - i) % 2 === 0) {',
  '      var r = bytesToString(buf, "utf16le", i, buf.length);',
  '      if (r) {',
  '        var c = r.charCodeAt(r.length - 1);',
  '        if (c >= 0xD800 && c <= 0xDBFF) {',
  '          this.lastNeed = 2; this.lastTotal = 4;',
  '          this.lastChar[0] = buf[buf.length - 2];',
  '          this.lastChar[1] = buf[buf.length - 1];',
  '          return r.slice(0, -1);',
  '        }',
  '      }',
  '      return r;',
  '    }',
  '    this.lastNeed = 1; this.lastTotal = 2;',
  '    this.lastChar[0] = buf[buf.length - 1];',
  '    return bytesToString(buf, "utf16le", i, buf.length - 1);',
  '  }',
  '  function utf16End(buf) {',
  '    var r = (buf && buf.length) ? this.write(buf) : "";',
  '    if (this.lastNeed) {',
  '      var end = this.lastTotal - this.lastNeed;',
  '      return r + bytesToString(this.lastChar, "utf16le", 0, end);',
  '    }',
  '    return r;',
  '  }',
  '  function base64Text(buf, i) {',
  '    var n = (buf.length - i) % 3;',
  '    if (n === 0) { return bytesToString(buf, "base64", i, buf.length); }',
  '    this.lastNeed = 3 - n; this.lastTotal = 3;',
  '    if (n === 1) { this.lastChar[0] = buf[buf.length - 1]; }',
  '    else { this.lastChar[0] = buf[buf.length - 2]; this.lastChar[1] = buf[buf.length - 1]; }',
  '    return bytesToString(buf, "base64", i, buf.length - n);',
  '  }',
  '  function base64End(buf) {',
  '    var r = (buf && buf.length) ? this.write(buf) : "";',
  '    if (this.lastNeed) { return r + bytesToString(this.lastChar, "base64", 0, 3 - this.lastNeed); }',
  '    return r;',
  '  }',
  '  function simpleWrite(buf) { buf = toByteArray(buf); return bytesToString(buf, this.encoding, 0, buf.length); }',
  '  function simpleEnd(buf) { return (buf && buf.length) ? this.write(buf) : ""; }',
  '  function decoderWrite(buf) {',
  '    buf = toByteArray(buf);',
  '    if (buf.length === 0) { return ""; }',
  '    var r, i;',
  '    if (this.lastNeed) {',
  '      r = this.fillLast(buf);',
  '      if (r === undefined) { return ""; }',
  '      i = this.lastNeed;',
  '      this.lastNeed = 0;',
  '    } else {',
  '      i = 0;',
  '    }',
  '    if (i < buf.length) { return r ? r + this.text(buf, i) : this.text(buf, i); }',
  '    return r || "";',
  '  }',
  '  function decoderFillLast(buf) {',
  '    if (this.lastNeed <= buf.length) {',
  '      copyInto(this.lastChar, this.lastTotal - this.lastNeed, buf, 0, this.lastNeed);',
  '      return bytesToString(this.lastChar, this.encoding, 0, this.lastTotal);',
  '    }',
  '    copyInto(this.lastChar, this.lastTotal - this.lastNeed, buf, 0, buf.length);',
  '    this.lastNeed -= buf.length;',
  '  }',
  '  function StringDecoder(encoding) {',
  '    this.encoding = normalizeEncoding(encoding);',
  '    switch (this.encoding) {',
  '      case "utf16le":',
  '        this.text = utf16Text; this.end = utf16End;',
  '        this.lastNeed = 0; this.lastTotal = 0; this.lastChar = [0, 0, 0, 0];',
  '        break;',
  '      case "utf8":',
  '        this.fillLast = utf8FillLast;',
  '        this.lastNeed = 0; this.lastTotal = 0; this.lastChar = [0, 0, 0, 0];',
  '        break;',
  '      case "base64":',
  '        this.text = base64Text; this.end = base64End;',
  '        this.lastNeed = 0; this.lastTotal = 0; this.lastChar = [0, 0, 0];',
  '        break;',
  '      default:',
  '        this.write = simpleWrite; this.end = simpleEnd;',
  '        break;',
  '    }',
  '  }',
  '  StringDecoder.prototype.write = decoderWrite;',
  '  StringDecoder.prototype.end = utf8End;',
  '  StringDecoder.prototype.text = utf8Text;',
  '  StringDecoder.prototype.fillLast = decoderFillLast;',
  '  return { StringDecoder: StringDecoder };',
  '}',
].join('\n');

/** Every module the sandbox can serve. Grown deliberately, one vetted entry at a time (M2/M3). */
export const SANDBOX_MODULES: SandboxModuleDefinition[] = [
  { name: 'path', aliases: ['node:path'], factorySource: PATH_FACTORY },
  { name: 'crypto', aliases: ['node:crypto'], factorySource: CRYPTO_FACTORY },
  { name: 'events', aliases: ['node:events'], factorySource: EVENTS_FACTORY },
  { name: 'string_decoder', aliases: ['node:string_decoder'], factorySource: STRING_DECODER_FACTORY },
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
