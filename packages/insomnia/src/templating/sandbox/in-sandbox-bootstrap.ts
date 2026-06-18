/**
 * JS evaluated *inside* the QuickJS sandbox, as global code, before any plugin source. It:
 *   1. polyfills the Web APIs QuickJS lacks (btoa/atob/TextEncoder/TextDecoder) and `console`,
 *   2. provides a minimal CommonJS `require` shim (expanded in later milestones),
 *   3. rebuilds the plugin `context` object in pure JS over the bulk-copied envelope, with every
 *      async capability routed through the single `__hostBridge` host function, and
 *   4. exposes `__invoke()` which finds the requested tag in the evaluated plugin module and runs it.
 *
 * The host side injects `__hostBridge(path, bodyJson) -> Promise<resultJson>` and (optionally)
 * `__hostConsole(level, msg)` as globals before this runs. The rebuilt context is structurally
 * identical to the worker context in `liquid-extension-worker.ts` — that file is the contract.
 *
 * Authoring constraint: this is a plain JS string evaluated by QuickJS, so it deliberately avoids
 * template literals / optional chaining / modern globals and sticks to widely-supported ES5-ish JS.
 */
export const IN_SANDBOX_BOOTSTRAP = [
  '(function(){',
  '  "use strict";',

  // --- capture the host-injected plumbing into closure locals, then delete the globals at the end ---
  // so plugin code (evaluated after this bootstrap) can never reach the raw bridge / crypto / console
  // host functions. The closures below keep these references alive; QuickJS retains the underlying
  // host-function objects as long as a local still points at them.
  '  var __hb = globalThis.__hostBridge;',
  '  var __ch = globalThis.__cryptoHash, __chm = globalThis.__cryptoHmac, __crb = globalThis.__cryptoRandomBytes, __cru = globalThis.__cryptoRandomUUID;',
  '  var __hc = globalThis.__hostConsole;',

  '  var T = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";',

  // --- btoa / atob (operate on Latin1 binary strings, matching the browser) ---
  '  if (typeof globalThis.btoa !== "function") {',
  '    globalThis.btoa = function (data) {',
  '      var str = String(data); var out = ""; var i = 0;',
  '      while (i < str.length) {',
  '        var c1 = str.charCodeAt(i++); var c2 = str.charCodeAt(i++); var c3 = str.charCodeAt(i++);',
  '        if (c1 > 255 || (!isNaN(c2) && c2 > 255) || (!isNaN(c3) && c3 > 255)) { throw new Error("btoa: invalid character"); }',
  '        var e1 = c1 >> 2;',
  '        var e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : (c2 >> 4));',
  '        var e3 = isNaN(c2) ? 64 : (((c2 & 15) << 2) | (isNaN(c3) ? 0 : (c3 >> 6)));',
  '        var e4 = isNaN(c3) ? 64 : (c3 & 63);',
  '        out += T.charAt(e1) + T.charAt(e2) + (e3 === 64 ? "=" : T.charAt(e3)) + (e4 === 64 ? "=" : T.charAt(e4));',
  '      }',
  '      return out;',
  '    };',
  '  }',
  '  if (typeof globalThis.atob !== "function") {',
  '    globalThis.atob = function (data) {',
  '      var str = String(data).replace(/\\s/g, "").replace(/=+$/, "");',
  '      var out = ""; var bits = 0; var buffer = 0;',
  '      for (var i = 0; i < str.length; i++) {',
  '        var idx = T.indexOf(str.charAt(i));',
  '        if (idx === -1) { throw new Error("atob: invalid character"); }',
  '        buffer = (buffer << 6) | idx; bits += 6;',
  '        if (bits >= 8) { bits -= 8; out += String.fromCharCode((buffer >> bits) & 255); }',
  '      }',
  '      return out;',
  '    };',
  '  }',

  // --- TextEncoder / TextDecoder (UTF-8 only) ---
  '  if (typeof globalThis.TextEncoder !== "function") {',
  '    globalThis.TextEncoder = function () {};',
  '    globalThis.TextEncoder.prototype.encode = function (input) {',
  '      var str = String(input); var bytes = [];',
  '      for (var i = 0; i < str.length; i++) {',
  '        var code = str.charCodeAt(i);',
  '        if (code < 128) { bytes.push(code); }',
  '        else if (code < 2048) { bytes.push(192 | (code >> 6), 128 | (code & 63)); }',
  '        else if (code >= 55296 && code <= 56319) {',
  '          var lo = str.charCodeAt(++i);',
  '          var cp = ((code - 55296) << 10) + (lo - 56320) + 65536;',
  '          bytes.push(240 | (cp >> 18), 128 | ((cp >> 12) & 63), 128 | ((cp >> 6) & 63), 128 | (cp & 63));',
  '        } else { bytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63)); }',
  '      }',
  '      return new Uint8Array(bytes);',
  '    };',
  '  }',
  '  if (typeof globalThis.TextDecoder !== "function") {',
  '    globalThis.TextDecoder = function () {};',
  '    globalThis.TextDecoder.prototype.decode = function (buf) {',
  '      var bytes = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf || []);',
  '      var out = ""; var i = 0;',
  '      while (i < bytes.length) {',
  '        var b = bytes[i++];',
  '        if (b < 128) { out += String.fromCharCode(b); }',
  '        else if (b >= 192 && b < 224) { var b2 = bytes[i++]; out += String.fromCharCode(((b & 31) << 6) | (b2 & 63)); }',
  '        else if (b >= 224 && b < 240) { var c2 = bytes[i++], c3 = bytes[i++]; out += String.fromCharCode(((b & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63)); }',
  '        else { var d2 = bytes[i++], d3 = bytes[i++], d4 = bytes[i++]; var cp = (((b & 7) << 18) | ((d2 & 63) << 12) | ((d3 & 63) << 6) | (d4 & 63)) - 65536; out += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023)); }',
  '      }',
  '      return out;',
  '    };',
  '  }',

  // --- console (forwards to the host if a sink was injected) ---
  '  function __fmt(args) { var parts = []; for (var i = 0; i < args.length; i++) { var a = args[i]; try { parts.push(typeof a === "string" ? a : JSON.stringify(a)); } catch (e) { parts.push(String(a)); } } return parts.join(" "); }',
  '  function __log(level) { return function () { if (typeof __hc === "function") { __hc(level, __fmt(arguments)); } }; }',
  '  globalThis.console = { log: __log("log"), info: __log("info"), warn: __log("warn"), error: __log("error"), debug: __log("debug") };',

  // --- the single async bridge helper ---
  '  function __bridge(path, body) {',
  '    return __hb(path, JSON.stringify(body || {})).then(function (raw) {',
  '      var res = JSON.parse(raw);',
  '      if (!res.ok) { throw new Error(res.error && res.error.message ? res.error.message : "host bridge error: " + path); }',
  '      return res.value;',
  '    });',
  '  }',

  // --- a Response-like wrapper for network.sendRequestWithoutSideEffects ---
  '  function __wrapResponse(r) {',
  '    if (r === null || typeof r !== "object") { return r; }',
  '    return {',
  '      status: r.status, statusText: r.statusText, headers: r.headers,',
  '      ok: r.status >= 200 && r.status < 300,',
  '      text: function () { return Promise.resolve(r._bodyText); },',
  '      json: function () { return Promise.resolve(JSON.parse(r._bodyText)); }',
  '    };',
  '  }',

  // --- minimal CommonJS require shim (expanded in M2/M3) ---
  '  globalThis.__require = function (name) {',
  '    if (name === "path") {',
  '      return {',
  '        sep: "/",',
  '        basename: function (p) { var s = String(p).split("/"); return s[s.length - 1]; },',
  '        extname: function (p) { var b = String(p).split("/").pop(); var d = b.lastIndexOf("."); return d > 0 ? b.slice(d) : ""; },',
  '        join: function () { return Array.prototype.slice.call(arguments).join("/").replace(/\\/+/g, "/"); }',
  '      };',
  '    }',
  // crypto is backed by synchronous host functions (real host crypto), so digest()/randomBytes()
  // return values inline — matching node:crypto's synchronous contract.
  '    if (name === "crypto" || name === "node:crypto") {',
  '      if (typeof __ch !== "function") { throw new Error("\'crypto\' is not available in this sandbox"); }',
  '      var mkDigester = function (compute) {',
  '        var parts = [];',
  '        var obj = {',
  '          update: function (data) { parts.push(typeof data === "string" ? data : String(data)); return obj; },',
  '          digest: function (enc) { return compute(parts.join(""), enc || "hex"); }',
  '        };',
  '        return obj;',
  '      };',
  '      return {',
  '        createHash: function (algo) { return mkDigester(function (data, enc) { return __ch(algo, data, "utf8", enc); }); },',
  '        createHmac: function (algo, key) { var k = typeof key === "string" ? key : String(key); return mkDigester(function (data, enc) { return __chm(algo, k, data, enc); }); },',
  '        randomBytes: function (size) {',
  '          var b64 = __crb(size);',
  '          var binary = atob(b64);',
  '          return {',
  '            length: binary.length,',
  '            toString: function (enc) {',
  '              if (enc === "base64") { return b64; }',
  '              if (enc === "latin1" || enc === "binary") { return binary; }',
  '              var hex = ""; for (var i = 0; i < binary.length; i++) { hex += ("0" + binary.charCodeAt(i).toString(16)).slice(-2); } return hex;',
  '            }',
  '          };',
  '        },',
  '        randomUUID: function () { return __cru(); }',
  '      };',
  '    }',
  '    throw new Error("Cannot find module \'" + name + "\' in sandbox (not yet supported)");',
  '  };',

  // --- rebuild the plugin context over the bulk-copied envelope ---
  '  globalThis.__buildContext = function (env) {',
  '    var P = env.pluginName;',
  '    return {',
  '      app: {',
  '        alert: function (title, message) { return __bridge("app.alert", { title: title, message: message }); },',
  '        dialog: function (title) { return __bridge("app.dialog", { title: title }); },',
  '        prompt: function (title, options) { return __bridge("app.prompt", { title: title, options: options }); },',
  '        getPath: function (name) { return __bridge("app.getPath", { name: name }); },',
  '        getInfo: function () { return { version: env.appInfo.version, platform: env.appInfo.platform }; },',
  '        showSaveDialog: function (options) { return __bridge("app.showSaveDialog", { options: options }); },',
  '        clipboard: {',
  '          readText: function () { return __bridge("app.clipboard.readText", {}); },',
  '          writeText: function (text) { return __bridge("app.clipboard.writeText", { text: text }); },',
  '          clear: function () { return __bridge("app.clipboard.clear", {}); }',
  '        }',
  '      },',
  '      store: {',
  '        hasItem: function (key) { return __bridge("pluginData.hasItem", { pluginName: P, key: key }); },',
  '        setItem: function (key, value) { return __bridge("pluginData.setItem", { pluginName: P, key: key, value: value }); },',
  '        getItem: function (key) { return __bridge("pluginData.getItem", { pluginName: P, key: key }); },',
  '        removeItem: function (key) { return __bridge("pluginData.removeItem", { pluginName: P, key: key }); },',
  '        clear: function () { return __bridge("pluginData.clear", { pluginName: P }); },',
  '        all: function () { return __bridge("pluginData.all", { pluginName: P }); }',
  '      },',
  '      network: {',
  '        sendRequest: function (request, extraInfo) { return __bridge("network.sendRequest", { request: request, extraInfo: extraInfo }); },',
  '        sendRequestWithoutSideEffects: function (options) { return __bridge("network.sendRequestWithoutSideEffects", { options: options }).then(__wrapResponse); }',
  '      },',
  '      context: env.context,',
  '      meta: env.meta,',
  '      renderPurpose: env.renderPurpose,',
  '      util: {',
  '        readFile: function (path, encoding) { return __bridge("readFile", { path: path, encoding: encoding }); },',
  '        nodeOS: function () { return __bridge("nodeOS", {}); },',
  '        decode: function (buffer, encoding) { return __bridge("decode", { buffer: buffer, encoding: encoding }); },',
  '        encode: function (input, encoding) { return __bridge("encode", { input: input, encoding: encoding }); },',
  '        render: function (str) { return __bridge("util.render", { str: str, context: env.context, depth: (env.renderDepth || 0) + 1 }); },',
  '        openInBrowser: function (url) { return __bridge("openInBrowser", { url: url }); },',
  '        models: {',
  '          request: {',
  '            getById: function (id) { return __bridge("request.getById", { id: id }); },',
  '            getAncestors: function (request) { return __bridge("request.getAncestors", { request: request, types: ["RequestGroup", "Workspace"] }).then(function (anc) { return (anc || []).filter(function (doc) { return doc._id !== request._id; }); }); }',
  '          },',
  '          cloudCredential: {',
  '            getById: function (id) { return __bridge("cloudCredential.getById", { id: id }); },',
  '            update: function (originCredential, patch) { return __bridge("cloudCredential.update", { originCredential: originCredential, patch: patch }); }',
  '          },',
  '          workspace: { getById: function (id) { return __bridge("workspace.getById", { id: id }); } },',
  '          oAuth2Token: { getByRequestId: function (parentId) { return __bridge("oAuth2Token.getByRequestId", { parentId: parentId }); } },',
  '          cookieJar: {',
  '            getOrCreateForParentId: function (parentId) { return __bridge("cookieJar.getOrCreateForParentId", { parentId: parentId }); },',
  '            getCookiesForUrl: function (parentId, url) { return __bridge("cookieJar.getCookiesForUrl", { parentId: parentId, url: url }); }',
  '          },',
  '          response: {',
  '            getLatestForRequestId: function (requestId, environmentId) { return __bridge("response.getLatestForRequestId", { requestId: requestId, environmentId: environmentId }); },',
  '            getBodyBuffer: function (response, readFailureValue) { return __bridge("response.getBodyBuffer", { response: response, readFailureValue: readFailureValue }); }',
  '          },',
  '          settings: { get: function () { return __bridge("settings.get", {}); } }',
  '        }',
  '      }',
  '    };',
  '  };',

  // --- find the requested tag in the evaluated plugin module and run it ---
  '  globalThis.__invoke = function () {',
  '    var env = JSON.parse(globalThis.__envelopeJSON);',
  '    var ctx = globalThis.__buildContext(env);',
  '    var mod = globalThis.__pluginModule;',
  '    var tags = (mod && mod.templateTags) || [];',
  '    var tag = null;',
  '    for (var i = 0; i < tags.length; i++) { if (tags[i].name === globalThis.__tagName) { tag = tags[i]; break; } }',
  '    if (!tag) { throw new Error("Template tag \'" + globalThis.__tagName + "\' not found in plugin module"); }',
  '    var args = [ctx].concat(env.args || []);',
  '    return Promise.resolve(tag.run.apply(null, args)).then(function (r) { return r == null ? "" : String(r); });',
  '  };',

  // --- remove the raw host capabilities from the global so plugin code can only reach the rebuilt
  // context. The closures above retain the references they need (e.g. __bridge -> __hb). ---
  '  delete globalThis.__hostBridge;',
  '  delete globalThis.__cryptoHash; delete globalThis.__cryptoHmac; delete globalThis.__cryptoRandomBytes; delete globalThis.__cryptoRandomUUID;',
  '  delete globalThis.__hostConsole;',
  '})();',
].join('\n');

/**
 * Wrap raw plugin source as a CommonJS module, evaluate it, and stash its exports on
 * `globalThis.__pluginModule` for `__invoke()`. The source is concatenated at runtime (not baked
 * into a template literal), so plugin code can contain any characters safely.
 */
export const wrapPluginSource = (source: string): string =>
  [
    'globalThis.__pluginModule = (function () {',
    '  var module = { exports: {} };',
    '  var exports = module.exports;',
    '  (function (module, exports, require, __dirname, __filename) {',
    source,
    '  })(module, exports, globalThis.__require, "", "");',
    '  return module.exports;',
    '})();',
  ].join('\n');

/** The runner: kicks off the async invocation and parks the VM promise on `globalThis.__task`. */
export const RUNNER = 'globalThis.__task = globalThis.__invoke();';
