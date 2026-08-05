/**
 * Ambient globals seeded into every QuickJS sandbox context (sandbox plan M2). These are the
 * language/Web APIs QuickJS's base runtime lacks but plugin code routinely assumes are present, so
 * — unlike `require()` modules (M1) — they are NOT manifest-gated: they are pure-JS or host-backed
 * safe equivalents with no escape path, always available.
 *
 * Evaluated AFTER `IN_SANDBOX_BOOTSTRAP` (which defines `atob`/`btoa`/`TextEncoder`/`TextDecoder`
 * and captures the envelope as `__env`) and after the host crypto functions are installed, both of
 * which these implementations depend on.
 *
 * Authoring constraint: this is a plain JS string eval'd by QuickJS — no template literals, optional
 * chaining, or modern globals; widely-supported ES5-ish JS only (same rule as the bootstrap).
 *
 * SECURITY: `crypto.getRandomValues` / `crypto.subtle` are backed by the host crypto functions
 * (`__cryptoRandomBytes` / `__cryptoHash`) installed before this runs. When those are absent (a
 * sandbox created without hostCrypto), the methods throw rather than returning weak randomness.
 */
export const SANDBOX_GLOBALS_SOURCE = [
  '(function(){',
  '  "use strict";',

  // appInfo (platform/arch/version) is injected by the host as its own global — this IIFE runs in a
  // separate scope from the bootstrap, so it cannot read the bootstrap-private `__env`. The info is
  // non-sensitive (already exposed via context.app.getInfo()); read it once and delete the global.
  '  var __appInfo = {};',
  '  try { __appInfo = JSON.parse(globalThis.__sandboxAppInfoJSON || "{}"); } catch (e) { __appInfo = {}; }',
  '  delete globalThis.__sandboxAppInfoJSON;',

  // Capture then drop the crypto natives so plugin code can\'t call them directly, bypassing the
  // crypto/require("crypto") wrappers below — mirrors the __hostBridge capture-then-delete pattern
  // in in-sandbox-bootstrap.ts. Each is optional (installHostCrypto is skipped when hostCrypto isn\'t
  // supplied), so the captured locals may be undefined; every call site below already checks
  // typeof === "function" before use.
  '  var __cryptoHashFn = globalThis.__cryptoHash;',
  '  var __cryptoHmacFn = globalThis.__cryptoHmac;',
  '  var __cryptoRandomBytesFn = globalThis.__cryptoRandomBytes;',
  '  var __cryptoRandomUUIDFn = globalThis.__cryptoRandomUUID;',
  '  delete globalThis.__cryptoHash;',
  '  delete globalThis.__cryptoHmac;',
  '  delete globalThis.__cryptoRandomBytes;',
  '  delete globalThis.__cryptoRandomUUID;',

  // require("crypto") (module-registry.ts) needs the same natives, but its factory only runs lazily
  // on a plugin\'s first require("crypto") call — arbitrarily later than this IIFE, i.e. after the
  // raw natives above are already gone. So its exports are built eagerly here, in the same scope as
  // the capture, as plain interpreted closures over the captured locals (never touching
  // globalThis.__crypto* again) — module-registry.ts\'s factory just returns this pre-built object.
  // Safe to leave reachable: like context.*\'s __bridge wrappers, these are interpreted JS with no
  // raw native passthrough, not the bare host callbacks the capture above hides.
  '  globalThis.__nodeCryptoExports = (function () {',
  '    var mkDigester = function (compute) {',
  '      var parts = [];',
  '      var obj = {',
  '        update: function (data) { parts.push(typeof data === "string" ? data : String(data)); return obj; },',
  '        digest: function (enc) { return compute(parts.join(""), enc || "hex"); }',
  '      };',
  '      return obj;',
  '    };',
  '    return {',
  '      createHash: function (algo) {',
  '        if (typeof __cryptoHashFn !== "function") { throw new Error("crypto is not available in this sandbox"); }',
  '        return mkDigester(function (data, enc) { return __cryptoHashFn(algo, data, "utf8", enc); });',
  '      },',
  '      createHmac: function (algo, key) {',
  '        if (typeof __cryptoHmacFn !== "function") { throw new Error("crypto is not available in this sandbox"); }',
  '        var k = typeof key === "string" ? key : String(key);',
  '        return mkDigester(function (data, enc) { return __cryptoHmacFn(algo, k, data, enc); });',
  '      },',
  '      randomBytes: function (size) {',
  '        if (typeof __cryptoRandomBytesFn !== "function") { throw new Error("crypto is not available in this sandbox"); }',
  '        var b64 = __cryptoRandomBytesFn(size);',
  '        var binary = atob(b64);',
  '        return {',
  '          length: binary.length,',
  '          toString: function (enc) {',
  '            if (enc === "base64") { return b64; }',
  '            if (enc === "latin1" || enc === "binary") { return binary; }',
  '            var hex = ""; for (var i = 0; i < binary.length; i++) { hex += ("0" + binary.charCodeAt(i).toString(16)).slice(-2); } return hex;',
  '          }',
  '        };',
  '      },',
  '      randomUUID: function () {',
  '        if (typeof __cryptoRandomUUIDFn !== "function") { throw new Error("crypto is not available in this sandbox"); }',
  '        return __cryptoRandomUUIDFn();',
  '      }',
  '    };',
  '  })();',

  // --- Buffer (subset: from/alloc/isBuffer/concat + toString for utf8/base64/hex/latin1) ---
  // Modeled as a Uint8Array with a patched toString + _isBuffer marker — enough for the common
  // "Buffer.from(x).toString(enc)" plugin usage without dragging in Node's full Buffer.
  '  if (typeof globalThis.Buffer === "undefined") {',
  '    var __bytesToLatin1 = function (bytes) {',
  '      var s = ""; for (var i = 0; i < bytes.length; i++) { s += String.fromCharCode(bytes[i] & 255); } return s;',
  '    };',
  '    var __hexToBytes = function (hex) {',
  '      var clean = String(hex).replace(/[^0-9a-fA-F]/g, ""); var out = [];',
  '      for (var i = 0; i + 1 < clean.length; i += 2) { out.push(parseInt(clean.substr(i, 2), 16)); }',
  '      return out;',
  '    };',
  '    var __bufToString = function (enc) {',
  '      var e = (enc || "utf8").toLowerCase();',
  '      if (e === "base64") { return btoa(__bytesToLatin1(this)); }',
  '      if (e === "latin1" || e === "binary") { return __bytesToLatin1(this); }',
  '      if (e === "hex") { var h = ""; for (var i = 0; i < this.length; i++) { h += ("0" + this[i].toString(16)).slice(-2); } return h; }',
  '      return new TextDecoder().decode(this);',
  '    };',
  '    var __mkBuffer = function (bytes) {',
  '      var b = new Uint8Array(bytes);',
  '      b._isBuffer = true; b.toString = __bufToString; return b;',
  '    };',
  '    var BufferShim = {',
  '      from: function (value, encoding) {',
  '        if (typeof value === "string") {',
  '          var e = (encoding || "utf8").toLowerCase();',
  '          if (e === "base64") { var bin = atob(value); var arr = []; for (var i = 0; i < bin.length; i++) { arr.push(bin.charCodeAt(i) & 255); } return __mkBuffer(arr); }',
  '          if (e === "hex") { return __mkBuffer(__hexToBytes(value)); }',
  '          if (e === "latin1" || e === "binary") { var la = []; for (var j = 0; j < value.length; j++) { la.push(value.charCodeAt(j) & 255); } return __mkBuffer(la); }',
  '          return __mkBuffer(new TextEncoder().encode(value));',
  '        }',
  '        if (value && (value instanceof Uint8Array || Object.prototype.toString.call(value) === "[object Array]")) {',
  '          return __mkBuffer(value);',
  '        }',
  '        if (typeof value === "number") { return __mkBuffer(new Uint8Array(value)); }',
  '        throw new TypeError("Buffer.from: unsupported input");',
  '      },',
  '      alloc: function (size, fill) {',
  '        var b = __mkBuffer(new Uint8Array(size));',
  '        if (typeof fill === "number") { for (var i = 0; i < b.length; i++) { b[i] = fill & 255; } }',
  '        return b;',
  '      },',
  '      isBuffer: function (x) { return !!(x && x._isBuffer); },',
  '      concat: function (list) {',
  '        var total = 0; for (var i = 0; i < list.length; i++) { total += list[i].length; }',
  '        var out = new Uint8Array(total); var off = 0;',
  '        for (var j = 0; j < list.length; j++) { out.set(list[j], off); off += list[j].length; }',
  '        return __mkBuffer(out);',
  '      }',
  '    };',
  '    globalThis.Buffer = BufferShim;',
  '  }',

  // --- process (frozen stub: platform/arch from the envelope, empty env, microtask nextTick) ---
  // Frozen with an empty, frozen `env` so a plugin can neither read host environment variables nor
  // mutate the stub. platform mirrors the host so it matches the legacy in-process render.
  '  if (typeof globalThis.process === "undefined") {',
  '    var proc = {',
  '      platform: __appInfo.platform || "unknown",',
  '      arch: __appInfo.arch || "unknown",',
  '      version: "",',
  '      versions: Object.freeze({}),',
  '      env: Object.freeze({}),',
  '      argv: Object.freeze([]),',
  '      nextTick: function (fn) { var a = Array.prototype.slice.call(arguments, 1); Promise.resolve().then(function () { fn.apply(null, a); }); }',
  '    };',
  '    globalThis.process = Object.freeze(proc);',
  '  }',

  // --- crypto (Web Crypto subset: getRandomValues + randomUUID + subtle.digest), host-backed ---
  '  if (typeof globalThis.crypto === "undefined") {',
  '    var __algoMap = { "SHA-1": "sha1", "SHA-256": "sha256", "SHA-384": "sha384", "SHA-512": "sha512" };',
  '    globalThis.crypto = {',
  // host-backed; throw (not weak fallback) when the host binding is absent, like getRandomValues.
  '      randomUUID: function () {',
  '        if (typeof __cryptoRandomUUIDFn !== "function") { throw new Error("crypto.randomUUID is not available in this sandbox"); }',
  '        return __cryptoRandomUUIDFn();',
  '      },',
  '      getRandomValues: function (typedArray) {',
  '        if (typeof __cryptoRandomBytesFn !== "function") { throw new Error("crypto.getRandomValues is not available in this sandbox"); }',
  '        if (!typedArray || typeof typedArray.byteLength !== "number") { throw new TypeError("getRandomValues expects a TypedArray"); }',
  // Enforce the WebCrypto 65536-byte quota. This both matches the spec (which throws
  // QuotaExceededError past this limit) and stays within the host __cryptoRandomBytes clamp, so we
  // never silently zero-fill a tail — a request that would be short-changed fails loudly instead.
  '        if (typedArray.byteLength > 65536) { throw new Error("Failed to execute \'getRandomValues\': The ArrayBufferView\'s byte length (" + typedArray.byteLength + ") exceeds the number of bytes of entropy available via this API (65536)."); }',
  '        var bin = atob(__cryptoRandomBytesFn(typedArray.byteLength));',
  '        var view = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);',
  '        for (var i = 0; i < view.length; i++) { view[i] = bin.charCodeAt(i) & 255; }',
  '        return typedArray;',
  '      },',
  '      subtle: {',
  '        digest: function (algorithm, data) {',
  '          return Promise.resolve().then(function () {',
  '            if (typeof __cryptoHashFn !== "function") { throw new Error("crypto.subtle is not available in this sandbox"); }',
  '            var name = typeof algorithm === "string" ? algorithm : (algorithm && algorithm.name);',
  '            var algo = __algoMap[name]; if (!algo) { throw new Error("Unsupported digest algorithm: " + name); }',
  '            var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);',
  '            var latin1 = ""; for (var i = 0; i < bytes.length; i++) { latin1 += String.fromCharCode(bytes[i] & 255); }',
  '            var hex = __cryptoHashFn(algo, latin1, "latin1", "hex");',
  '            var out = new Uint8Array(hex.length / 2);',
  '            for (var j = 0; j < out.length; j++) { out[j] = parseInt(hex.substr(j * 2, 2), 16); }',
  '            return out.buffer;',
  '          });',
  '        }',
  '      }',
  '    };',
  '  }',

  // --- URLSearchParams (full common surface over an ordered [key,value] pair list) ---
  '  if (typeof globalThis.URLSearchParams === "undefined") {',
  '    var USP = function (init) {',
  '      this._p = [];',
  '      if (init == null || init === "") { return; }',
  '      if (typeof init === "string") {',
  '        var s = init.charAt(0) === "?" ? init.slice(1) : init;',
  '        if (s === "") { return; }',
  '        var pairs = s.split("&");',
  '        for (var i = 0; i < pairs.length; i++) {',
  '          if (pairs[i] === "") { continue; }',
  '          var eq = pairs[i].indexOf("=");',
  '          var k = eq === -1 ? pairs[i] : pairs[i].slice(0, eq);',
  '          var v = eq === -1 ? "" : pairs[i].slice(eq + 1);',
  '          this._p.push([decodeURIComponent(k.replace(/\\+/g, " ")), decodeURIComponent(v.replace(/\\+/g, " "))]);',
  '        }',
  '      } else if (Object.prototype.toString.call(init) === "[object Array]") {',
  '        for (var a = 0; a < init.length; a++) { this._p.push([String(init[a][0]), String(init[a][1])]); }',
  // Copy-construct from another URLSearchParams; without this the object branch would read its
  // internal _p field as a bogus "_p" param.
  '      } else if (init instanceof USP) {',
  '        for (var c = 0; c < init._p.length; c++) { this._p.push([init._p[c][0], init._p[c][1]]); }',
  '      } else if (typeof init === "object") {',
  '        for (var key in init) { if (Object.prototype.hasOwnProperty.call(init, key)) { this._p.push([key, String(init[key])]); } }',
  '      }',
  '    };',
  '    var __enc = function (s) { return encodeURIComponent(s).replace(/%20/g, "+"); };',
  '    USP.prototype.append = function (k, v) { this._p.push([String(k), String(v)]); };',
  // WHATWG: update the FIRST match in place, drop later ones; append if absent.
  '    USP.prototype.set = function (k, v) {',
  '      var found = false; k = String(k); v = String(v);',
  '      for (var i = 0; i < this._p.length;) { if (this._p[i][0] === k) { if (found) { this._p.splice(i, 1); continue; } this._p[i][1] = v; found = true; } i++; }',
  '      if (!found) { this._p.push([k, v]); }',
  '    };',
  '    USP.prototype.get = function (k) { k = String(k); for (var i = 0; i < this._p.length; i++) { if (this._p[i][0] === k) { return this._p[i][1]; } } return null; };',
  '    USP.prototype.getAll = function (k) { k = String(k); var out = []; for (var i = 0; i < this._p.length; i++) { if (this._p[i][0] === k) { out.push(this._p[i][1]); } } return out; };',
  '    USP.prototype.has = function (k) { return this.get(k) !== null; };',
  '    USP.prototype["delete"] = function (k) { k = String(k); for (var i = this._p.length - 1; i >= 0; i--) { if (this._p[i][0] === k) { this._p.splice(i, 1); } } };',
  '    USP.prototype.forEach = function (cb, thisArg) { for (var i = 0; i < this._p.length; i++) { cb.call(thisArg, this._p[i][1], this._p[i][0], this); } };',
  '    USP.prototype.sort = function () { this._p.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }); };',
  '    USP.prototype.toString = function () {',
  '      var parts = []; for (var i = 0; i < this._p.length; i++) { parts.push(__enc(this._p[i][0]) + "=" + __enc(this._p[i][1])); } return parts.join("&");',
  '    };',
  '    globalThis.URLSearchParams = USP;',
  '  }',

  // --- URL (pragmatic absolute-URL parser covering the common WHATWG surface) ---
  // Parses scheme://[host[:port]][/path][?query][#hash]. Sufficient for the "new URL(str).<part>"
  // and ".searchParams" usage plugins rely on; relative-URL resolution is out of scope for M2.
  '  if (typeof globalThis.URL === "undefined") {',
  '    var __defaultPorts = { "http:": "80", "https:": "443", "ftp:": "21", "ws:": "80", "wss:": "443" };',
  '    var URLShim = function (input, base) {',
  '      var url = String(input);',
  '      var m = /^([a-zA-Z][a-zA-Z0-9+.-]*:)(\\/\\/)?([^\\/?#]*)([^?#]*)(\\?[^#]*)?(#.*)?$/.exec(url);',
  '      if (!m) { throw new TypeError("Invalid URL: " + url); }',
  '      this.protocol = m[1].toLowerCase();',
  '      var authority = m[3] || "";',
  '      var at = authority.lastIndexOf("@");',
  '      if (at !== -1) {',
  '        var creds = authority.slice(0, at); authority = authority.slice(at + 1);',
  '        var ci = creds.indexOf(":");',
  '        this.username = ci === -1 ? creds : creds.slice(0, ci);',
  '        this.password = ci === -1 ? "" : creds.slice(ci + 1);',
  '      } else { this.username = ""; this.password = ""; }',
  '      var colon = authority.indexOf(":");',
  '      if (colon === -1) { this.hostname = authority.toLowerCase(); this.port = ""; }',
  '      else { this.hostname = authority.slice(0, colon).toLowerCase(); this.port = authority.slice(colon + 1); }',
  '      if (this.port !== "" && __defaultPorts[this.protocol] === this.port) { this.port = ""; }',
  '      this.host = this.port === "" ? this.hostname : this.hostname + ":" + this.port;',
  '      this.pathname = m[4] || (authority ? "/" : "");',
  '      this.search = m[5] || "";',
  '      this.hash = m[6] || "";',
  '      this.searchParams = new globalThis.URLSearchParams(this.search);',
  '      var hasAuthority = !!m[2];',
  '      this.origin = hasAuthority && this.protocol !== "file:" ? this.protocol + "//" + this.host : "null";',
  '      this.href = this.protocol + (hasAuthority ? "//" : "") + (this.username ? this.username + (this.password ? ":" + this.password : "") + "@" : "") + this.host + this.pathname + this.search + this.hash;',
  '    };',
  '    URLShim.prototype.toString = function () { return this.href; };',
  '    URLShim.prototype.toJSON = function () { return this.href; };',
  '    globalThis.URL = URLShim;',
  '  }',
  '})();',
].join('\n');
