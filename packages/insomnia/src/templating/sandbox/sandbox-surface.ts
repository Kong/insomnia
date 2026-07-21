import crypto from 'node:crypto';

import { ALL_CAPABILITIES } from './host-bridge';
import type { ContextEnvelope } from './marshal';
import { ALL_SANDBOX_MODULES } from './module-registry';
import { type HostCrypto, runTagInSandbox } from './plugin-tag-sandbox';

// Real crypto backing so require('crypto') resolves instead of throwing "not available".
const nodeHostCrypto: HostCrypto = {
  hash: (algo, data, inputEncoding, outputEncoding) =>
    crypto
      .createHash(algo)
      .update(data, inputEncoding as crypto.Encoding)
      .digest(outputEncoding as crypto.BinaryToTextEncoding),
  hmac: (algo, key, data, outputEncoding) =>
    crypto
      .createHmac(algo, key)
      .update(data, 'utf8')
      .digest(outputEncoding as crypto.BinaryToTextEncoding),
  randomBytes: size => crypto.randomBytes(size).toString('base64'),
  randomUUID: () => crypto.randomUUID(),
};

/** One reachable key path inside the sandbox, as structured data so downstream checks filter on fields directly instead of regex-parsing a rendered line. */
export interface SurfaceEntry {
  /** Full dotted path, e.g. "globalThis.__cryptoHash" or 'require("crypto").createHash'. */
  path: string;
  /** The top-level root this path was reached from: "globalThis", "context", or 'require("name")'. */
  root: string;
  /** typeof the value, or a sentinel: "denied" (require() threw) / "getterThrew" (property access threw). */
  type?: string;
  /** Declared arity — functions only. */
  arity?: number;
  /** Function.prototype.toString() shows the engine's native-code marker — functions only. */
  native?: boolean;
  /** Whether the value has an own "prototype" property — functions/objects only. */
  ownPrototype?: boolean;
  /** Set instead of type/arity/etc. when this exact object was already reached via a different path. */
  aliasOf?: string;
  /** Set alongside type === "denied", the thrown error's message. */
  error?: string;
}

/**
 * Diagnostic-only, not imported by production code. Two probes, used by `npm run sandbox:surface`
 * and `sandbox-surface.test.ts`: `getSandboxSurface` enumerates every reachable key path inside the
 * sandbox; `getSandboxEscapeProbe` checks whether any of it actually points back to the real host.
 */
const buildSurfaceProbeSource = (tagName: string, moduleNames: string[], maxDepth: number): string => `
module.exports.templateTags = [{
  name: ${JSON.stringify(tagName)},
  args: [],
  run: function (context) {
    var seenObjs = [];
    var seenPaths = [];
    var entries = [];
    function hasOwnProp(obj, name) {
      try { return Object.prototype.hasOwnProperty.call(obj, name); } catch (e) { return false; }
    }
    function isNativeFn(fn) {
      try { return /\\[native code\\]/.test(Function.prototype.toString.call(fn)); } catch (e) { return false; }
    }
    // Shared so every entry gets arity/native/ownPrototype computed the same way, whether it's a
    // walked child property or a top-level require()'d value.
    function describeValue(path, root, val) {
      var t = typeof val;
      var entry = { path: path, root: root, type: t };
      if (t === 'function') {
        entry.arity = val.length;
        entry.native = isNativeFn(val);
        entry.ownPrototype = hasOwnProp(val, 'prototype');
      } else if (t === 'object' && val !== null) {
        entry.ownPrototype = hasOwnProp(val, 'prototype');
      }
      return entry;
    }
    // Records where an object was first reached across every root, so a later root revisiting the
    // same object emits a visible "aliasOf" entry instead of silently vanishing.
    function walk(obj, prefix, root, depth) {
      if (depth > ${maxDepth}) { return; }
      if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) { return; }
      var seenIdx = seenObjs.indexOf(obj);
      if (seenIdx !== -1) {
        entries.push({ path: prefix, root: root, aliasOf: seenPaths[seenIdx] });
        return;
      }
      seenObjs.push(obj); seenPaths.push(prefix);
      var names;
      try { names = Object.getOwnPropertyNames(obj).sort(); } catch (e) { return; }
      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        if (name === 'length' || name === 'name') { continue; } // noise on every function
        var path = prefix + '.' + name;
        var val;
        try { val = obj[name]; } catch (e) { entries.push({ path: path, root: root, type: 'getterThrew' }); continue; }
        entries.push(describeValue(path, root, val));
        if (name === 'prototype' && depth >= 1) { continue; } // engine surface, not ours
        if ((typeof val === 'object' && val !== null) || typeof val === 'function') { walk(val, path, root, depth + 1); }
      }
    }
    walk(globalThis, 'globalThis', 'globalThis', 0);
    walk(context, 'context', 'context', 0);
    var moduleNames = ${JSON.stringify(moduleNames)};
    for (var m = 0; m < moduleNames.length; m++) {
      var name = moduleNames[m];
      var rootName = "require(" + JSON.stringify(name) + ")";
      try {
        var requiredVal = require(name);
        // Always recorded so "did this module resolve" never depends on it having walkable children.
        entries.push(describeValue(rootName, rootName, requiredVal));
        walk(requiredVal, rootName, rootName, 0);
      } catch (e) {
        entries.push({ path: rootName, root: rootName, type: 'denied', error: e.message });
      }
    }
    return JSON.stringify(entries);
  },
}];
`;

/** Renders one SurfaceEntry back to readable "path: type(...)" text, for `npm run sandbox:surface` and the snapshot test. */
export const formatSurfaceEntry = (e: SurfaceEntry): string => {
  if (e.aliasOf) { return `${e.path}: <alias of ${e.aliasOf}>`; }
  if (e.type === 'denied') { return `${e.path}: <denied: ${e.error}>`; }
  if (e.type === 'getterThrew') { return `${e.path}: <getter threw>`; }
  if (e.type === 'function') { return `${e.path}: function(${e.arity})${e.native ? '[native]' : ''}`; }
  return `${e.path}: ${e.type}`;
};

export const formatSurfaceEntries = (entries: SurfaceEntry[]): string[] => entries.map(formatSurfaceEntry);

export interface SandboxSurfaceOptions {
  /** How many property levels deep to walk from each root. */
  maxDepth?: number;
  /** Module names to require and walk the exports of. Defaults to every registry module. */
  moduleNames?: string[];
  /** Capabilities to grant when building the `context` object. Defaults to every capability. */
  grantedCapabilities?: ContextEnvelope['grantedCapabilities'];
}

/** Runs the probe plugin in a real sandbox context and returns the structured entries it finds. */
export const getSandboxSurface = async (opts: SandboxSurfaceOptions = {}): Promise<SurfaceEntry[]> => {
  const { maxDepth = 3, moduleNames = ALL_SANDBOX_MODULES, grantedCapabilities = [...ALL_CAPABILITIES] } = opts;
  const envelope: ContextEnvelope = {
    args: [],
    context: {},
    meta: {},
    renderPurpose: 'preview',
    appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
    pluginName: 'sandbox-surface-probe',
    renderDepth: 0,
    grantedModules: moduleNames,
    grantedCapabilities,
  };
  const result = await runTagInSandbox({
    tagName: 'surface',
    pluginSource: buildSurfaceProbeSource('surface', moduleNames, maxDepth),
    envelope,
    bridge: async path => {
      throw new Error(`sandbox surface probe: unexpected bridge call: ${path}`);
    },
    hostCrypto: nodeHostCrypto,
  });
  return JSON.parse(result) as SurfaceEntry[];
};

// No hand-maintained denylist of "dangerous names" is needed for object references: every
// capability here bottoms out in a ctx.newFunction(...) install, so the structural scans below
// already cover that case with no name to guess in advance.

// Every ctx.newFunction(...) the host installs reports arity 0 and no own .prototype regardless of
// its real arity; these six are the only genuinely zero-arg-by-spec engine builtins that share that
// same fingerprint, so an unexpected new entry here means a real host-installed native, not an engine artifact.
const KNOWN_ENGINE_ZERO_ARITY_BUILTINS = new Set([
  'globalThis.Array.of',
  'globalThis.Date.now',
  'globalThis.Function.prototype',
  'globalThis.Iterator.concat',
  'globalThis.Math.random',
  'globalThis.Promise.withResolvers',
]);

/**
 * Structural fingerprint of a host-installed native reachable from globalThis, context, or any
 * require()'d module, with no advance knowledge of a bridge function's name required. globalThis.*
 * uses arity-0 + no-own-prototype (real engine builtins are excluded via KNOWN_ENGINE_ZERO_ARITY_BUILTINS);
 * context and require(...) exports have no legitimate native surface at all, so the native-code marker alone is enough.
 */
export const findUnaccountedHostNatives = (entries: SurfaceEntry[]): string[] => {
  const globalNatives = entries.filter(
    e =>
      e.root === 'globalThis' &&
      e.type === 'function' &&
      e.arity === 0 &&
      !e.ownPrototype &&
      !KNOWN_ENGINE_ZERO_ARITY_BUILTINS.has(e.path),
  );
  const contextAndModuleNatives = entries.filter(
    e => (e.root === 'context' || e.root.startsWith('require(')) && e.type === 'function' && e.native,
  );
  return [...globalNatives, ...contextAndModuleNatives].map(e => e.path);
};

/** Flags anything under context or require(...) that's the exact same object as something already reachable bare on globalThis — a "gate" that leaks its reference instead of actually gating. */
export const findLeakedGatedReferences = (entries: SurfaceEntry[]): string[] =>
  entries
    .filter(e => !!e.aliasOf && e.aliasOf.startsWith('globalThis.') && (e.root === 'context' || e.root.startsWith('require(')))
    .map(e => `${e.path} aliases ${e.aliasOf}`);

/**
 * The complete, reviewed set of sandbox-internal globals (`in-sandbox-bootstrap.ts`) exposed bare on
 * `globalThis` so `RUNNER`/`DESCRIBE_RUNNER` — each a separate `ctx.evalCode` call, so they can only
 * share state via `globalThis`, never lexical closure — can reach them. Locked against reassignment,
 * but reachable (and callable) by plugin top-level code, same as any other global. `__buildContext`
 * in particular returns a context wired to the real host bridge; discovery-time safety comes from
 * `runTagInSandbox` substituting a rejecting bridge when `discover: true`, not from hiding this
 * global. Adding a new one here forces a human to re-check that story still holds.
 */
export const SANDBOX_INTERNAL_GLOBALS = ['__buildContext', '__describeExports', '__invoke', '__loadPluginEntry', '__require'];

/** Filters sandbox surface entries down to the bare `globalThis.__*` internals (excluding the `.prototype` sibling lines already in the snapshot). */
export const findSandboxInternalGlobals = (entries: SurfaceEntry[]): string[] =>
  entries
    .filter(e => e.root === 'globalThis' && /^globalThis\.__[^.]+$/.test(e.path))
    .map(e => e.path.slice('globalThis.'.length));

/**
 * Tier B-deep reachability probe (discovery-time bridge escape coverage): recursively walks every
 * `globalThis`-reachable property (same walk/cycle-detection shape as `buildSurfaceProbeSource`) and
 * additionally *invokes* every function found with a couple of generic argument shapes, then walks
 * whatever it returns too — the real exploit shape is a bare `globalThis` function (`__buildContext`)
 * whose return value exposes further bridge-backed functions several levels down. Meant to run as
 * plugin top-level code during a `discover: true` run (no tag ever inserted). The authoritative check
 * is the host-side recording bridge seeing zero calls; nothing here reports its own pass/fail — a
 * bridge call from inside the sandbox is indistinguishable from any other promise-returning builtin.
 */
export const buildReachabilityProbeSource = (maxDepth = 2): string => `
(function () {
  var seen = [];
  var genericArgs = [
    [],
    [{ pluginName: 'probe', context: {}, meta: {}, renderPurpose: 'preview', appInfo: {} }],
  ];
  function walk(obj, depth) {
    if (depth > ${maxDepth}) { return; }
    if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) { return; }
    if (seen.indexOf(obj) !== -1) { return; }
    seen.push(obj);
    var names;
    try { names = Object.getOwnPropertyNames(obj).sort(); } catch (e) { return; }
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (name === 'length' || name === 'name' || name === 'prototype') { continue; }
      var val;
      try { val = obj[name]; } catch (e) { continue; }
      if (typeof val === 'function') {
        for (var a = 0; a < genericArgs.length; a++) {
          try {
            var r = val.apply(null, genericArgs[a]);
            if (r && typeof r.then === 'function') { r.then(function () {}, function () {}); }
            walk(r, 0);
          } catch (e) { /* probing only - a thrown arity/shape mismatch is not a finding */ }
        }
      }
      walk(val, depth + 1);
    }
  }
  walk(globalThis, 0);
})();
module.exports.templateTags = [];
`;

const ESCAPE_PROBE_TAG_NAME = 'escapeProbe';

// Checks whether `this`, Function('return this')(), ambient globals, or the process shim ever
// point back to the real host realm instead of the sandbox's own.
const ESCAPE_PROBE_SOURCE = `
globalThis.__probeModuleThisIsGlobal = (this === globalThis);
globalThis.__probeModuleThisType = typeof this;

module.exports.templateTags = [{
  name: ${JSON.stringify(ESCAPE_PROBE_TAG_NAME)},
  args: [],
  run: function () {
    var runThisIsGlobal = (this === globalThis);
    var runThisType = typeof this;

    var viaFunctionCtor;
    try {
      var g = Function('return this')();
      viaFunctionCtor = { isSandboxGlobal: g === globalThis, type: typeof g };
    } catch (e) { viaFunctionCtor = { error: e.message }; }

    var viaIndirectCtor;
    try {
      var g2 = (function () {}).constructor('return this')();
      viaIndirectCtor = { isSandboxGlobal: g2 === globalThis, type: typeof g2 };
    } catch (e) { viaIndirectCtor = { error: e.message }; }

    var proc = globalThis.process || {};
    return JSON.stringify({
      runThisIsGlobal: runThisIsGlobal,
      runThisType: runThisType,
      moduleThisIsGlobal: globalThis.__probeModuleThisIsGlobal,
      moduleThisType: globalThis.__probeModuleThisType,
      viaFunctionCtor: viaFunctionCtor,
      viaIndirectCtor: viaIndirectCtor,
      ambientGlobalLeaks: {
        global: typeof globalThis.global,
        require: typeof globalThis.require,
        module: typeof globalThis.module,
        __dirname: typeof globalThis.__dirname,
        __filename: typeof globalThis.__filename,
      },
      processShim: {
        envKeys: Object.keys(proc.env || {}),
        versionsKeys: Object.keys(proc.versions || {}),
        hasBinding: typeof proc.binding,
        hasMainModule: typeof proc.mainModule,
      },
    });
  },
}];
`;

export interface EscapeProbeResult {
  runThisIsGlobal: boolean;
  runThisType: string;
  moduleThisIsGlobal: boolean;
  moduleThisType: string;
  viaFunctionCtor: { isSandboxGlobal?: boolean; type?: string; error?: string };
  viaIndirectCtor: { isSandboxGlobal?: boolean; type?: string; error?: string };
  ambientGlobalLeaks: Record<'global' | 'require' | 'module' | '__dirname' | '__filename', string>;
  processShim: { envKeys: string[]; versionsKeys: string[]; hasBinding: string; hasMainModule: string };
}

export const getSandboxEscapeProbe = async (): Promise<EscapeProbeResult> => {
  const envelope: ContextEnvelope = {
    args: [],
    context: {},
    meta: {},
    renderPurpose: 'preview',
    appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
    pluginName: 'sandbox-escape-probe',
    renderDepth: 0,
    grantedModules: [],
    grantedCapabilities: [],
  };
  const result = await runTagInSandbox({
    tagName: ESCAPE_PROBE_TAG_NAME,
    pluginSource: ESCAPE_PROBE_SOURCE,
    envelope,
    bridge: async path => {
      throw new Error(`sandbox escape probe: unexpected bridge call: ${path}`);
    },
  });
  return JSON.parse(result) as EscapeProbeResult;
};
