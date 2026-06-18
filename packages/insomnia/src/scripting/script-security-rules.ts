export interface ASTRule {
  name: string;
  description: string;
}

export interface ThreatRule {
  name: string;
  description: string;
  maskName?: string;
  maskValue?: unknown;
  buildMaskValue?: (violationCheck: (script: string) => void) => unknown;
}

export const blockedPropertyRules: ASTRule[] = [
  {
    name: 'prototype',
    description:
      'Prototype mutation — direct assignment (e.g. Promise.prototype.then = ...) can corrupt built-ins for all code in the sandbox.',
  },
  { name: 'mainModule', description: 'Prevents accessing the reference property to the top-level module object.' },
  { name: 'constructor', description: 'Prevents accessing .constructor on any object.' },
  {
    name: '__proto__',
    description:
      "Prototype mutation — direct prototype chain manipulation; can reassign an object's prototype to a host object.",
  },
  {
    name: 'prepareStackTrace',
    description:
      'Stack inspection escape — V8 stack trace hook (CVE-2023-29017, CVE-2023-30547); a crafted Error can run arbitrary code during stringify.',
  },
  {
    name: 'captureStackTrace',
    description:
      'Stack inspection — V8 method that captures the current call stack onto an object, exposing stack frame host objects.',
  },
  {
    name: 'getPrototypeOf',
    description: 'Prototype chain traversal — can reach the .constructor of a host object and reconstruct Function.',
  },
  {
    name: 'setPrototypeOf',
    description:
      "Prototype mutation — directly replaces an object's prototype, enabling prototype chain manipulation at runtime.",
  },
  {
    name: 'getFunction',
    description: 'Stack inspection — V8 CallSite method that leaks unsanitised host objects from the call stack.',
  },
  {
    name: 'getThis',
    description: 'Stack inspection — V8 CallSite method that leaks the unsanitised receiver of each stack frame.',
  },
  {
    name: '__defineGetter__',
    description: 'Accessor helper — deprecated method that bypasses the normal property descriptor flow.',
  },
  {
    name: '__defineSetter__',
    description: 'Accessor helper — deprecated method that bypasses the normal property descriptor flow.',
  },
  {
    name: '__lookupGetter__',
    description: 'Accessor helper — deprecated method that can be used to inspect hidden property descriptors.',
  },
  {
    name: '__lookupSetter__',
    description: 'Accessor helper — deprecated method that can be used to inspect hidden property descriptors.',
  },
  {
    name: 'defineProperty',
    description:
      'Property descriptor manipulation — installs arbitrary getters, setters, or non-configurable properties on any object including built-ins.',
  },
  {
    name: 'defineProperties',
    description: 'Property descriptor manipulation — same as defineProperty but for multiple properties at once.',
  },
  {
    name: 'getOwnPropertyDescriptor',
    description:
      'Property descriptor inspection — returns the full descriptor including any getter/setter functions, which may be host objects.',
  },
  {
    name: 'getOwnPropertyDescriptors',
    description:
      'Property descriptor inspection — returns all property descriptors at once; same risk as getOwnPropertyDescriptor.',
  },
];

export const blockedRootRules: ASTRule[] = [
  {
    name: 'this',
    description:
      "Global object access — in the outer AsyncFunction scope (non-strict) 'this' is the host global object, with the same reach as globalThis.",
  },
  {
    name: 'globalThis',
    description:
      'Global object access — primary global object alias that exposes every host API that parameter masking is meant to hide.',
  },
  {
    name: 'global',
    description:
      'Global object access — Node.js alias for globalThis; dynamic access (e.g. global["req"+"uire"]) bypasses string-literal detection.',
  },
  {
    name: 'window',
    description:
      'Global object access — browser global alias; inside Electron it also reaches Node.js APIs via window.bridge and similar.',
  },
  {
    name: 'self',
    description:
      'Global object access — Web Worker / browser alias for globalThis; available in some Electron renderer contexts.',
  },
  {
    name: 'frames',
    description:
      'Global object access — browser alias for the window.frames collection; can be used to navigate to an unsandboxed global.',
  },
  {
    name: 'process',
    description:
      'Node.js internals access — exposes mainModule, env, and other Node.js internals not part of the supported scripting API.',
  },
  {
    name: 'module',
    description:
      'Module system bypass — Node.js module wrapper object; .require and .children expose the full module graph.',
  },
  {
    name: 'exports',
    description: 'Module system bypass — Node.js module exports object; mutating it affects the live module cache.',
  },
  {
    name: 'Buffer',
    description: 'Unsafe memory access — the Buffer global provides allocUnsafe(), which reads uninitialised memory.',
  },
  {
    name: 'constructor',
    description:
      'Function constructor escape — in AsyncFunction scope this IS AsyncFunction; a direct call constructs a new function in the real global scope.',
  },
  {
    name: 'arguments',
    description:
      "Caller inspection — can leak the caller's frame in generator or sloppy-mode contexts, exposing host objects.",
  },
];

export const maskRules: ThreatRule[] = [
  {
    name: 'globalThis',
    description:
      'Prevents access to the globalThis object to prevent exposure of process, require, and other host APIs that parameter masking is meant to hide.',
    maskName: 'globalThis',
    maskValue: undefined,
  },
  {
    name: 'global',
    description:
      'Prevents access to the global parameter (Node.js alias for globalThis) to prevent dynamic access to host APIs (e.g. global["req"+"uire"]).',
    maskName: 'global',
    maskValue: undefined,
  },
  {
    name: 'Function',
    description:
      'Prevents access to the Function constructor to prevent creation of new functions in the real global scope, escaping parameter-level masking (e.g. Function("return process")()).',
    maskName: 'Function',
    maskValue: undefined,
  },
  {
    name: 'process',
    description:
      'Prevents access to the process object to prevent exposure of mainModule, env, and other Node.js internals not part of the supported scripting API.',
    maskName: 'process',
    maskValue: undefined,
  },
  {
    name: 'setImmediate',
    description:
      'Prevents access to the setImmediate function to prevent its use as an untracked async scheduling side-channel.',
    maskName: 'setImmediate',
    maskValue: undefined,
  },
  {
    name: 'queueMicrotask',
    maskName: 'queueMicrotask',
    description:
      'Prevents access to the queueMicrotask function to prevent scheduling work outside the async/await flow tracked by the executor, which would make clean shutdown harder.',
    maskValue: undefined,
  },
  {
    name: 'Proxy',
    description:
      'Prevents access to the Proxy constructor to prevent apply/construct traps from receiving unwrapped host objects, which enables prototype chain traversal to real host globals (CVE-2023-32314).',
    maskName: 'Proxy',
    maskValue: undefined,
  },
  {
    name: 'Reflect',
    description:
      'Prevents access to the Reflect object to prevent Reflect.apply() and Reflect.construct() from invoking functions with an explicit this value, bypassing the strict-mode this===undefined invariant.',
    maskName: 'Reflect',
    maskValue: undefined,
  },
  {
    name: 'WebAssembly',
    description:
      'Prevents access to the WebAssembly API to prevent loading and executing arbitrary native bytecode, which would bypass JS-level sandboxing entirely.',
    maskName: 'WebAssembly',
    maskValue: undefined,
  },
];
