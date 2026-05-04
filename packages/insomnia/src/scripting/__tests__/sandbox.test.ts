import { describe, expect, it } from 'vitest';

import { checkSandboxViolations } from '../sandbox';
import { blockedPropertyRules, blockedRootRules } from '../script-security-policy';

const ALL_BLOCKED_PROPERTIES = new Set(blockedPropertyRules.map(r => r.name));
const ALL_BLOCKED_ROOTS = new Set(blockedRootRules.map(r => r.name));

const check = (script: string, props = ALL_BLOCKED_PROPERTIES, roots = ALL_BLOCKED_ROOTS) =>
  () => checkSandboxViolations(script, props, roots);

const blocked = (script: string) => expect(check(script)).toThrow();
const allowed = (script: string) => expect(check(script)).not.toThrow();

const withoutProperty = (name: string) =>
  new Set([...ALL_BLOCKED_PROPERTIES].filter(p => p !== name));

const withoutRoot = (name: string) =>
  new Set([...ALL_BLOCKED_ROOTS].filter(r => r !== name));

// Passes blockDynamic=false — mirrors disabling scriptBlockUnresolvableProperties in settings.
const checkNoDynamic = (script: string) =>
  () => checkSandboxViolations(script, ALL_BLOCKED_PROPERTIES, ALL_BLOCKED_ROOTS, false);

// ---------------------------------------------------------------------------
// Blocked properties — one canonical script per rule covering both dot and
// bracket notation where applicable. The unblocking section below mirrors
// each rule to confirm the disable path works too.
// ---------------------------------------------------------------------------

describe('checkSandboxViolations', () => {

  describe('blocked properties — dot notation', () => {
    it('blocks prototype',               () => blocked('Promise.prototype.then'));
    it('blocks mainModule',              () => blocked('proc.mainModule'));
    it('blocks constructor',             () => blocked('obj.constructor'));
    it('blocks __proto__',               () => blocked('obj.__proto__'));
    it('blocks prepareStackTrace',       () => blocked('Error.prepareStackTrace'));
    it('blocks captureStackTrace',       () => blocked('Error.captureStackTrace'));
    it('blocks getPrototypeOf',          () => blocked('Object.getPrototypeOf(target)'));
    it('blocks setPrototypeOf',          () => blocked('Object.setPrototypeOf(obj, null)'));
    it('blocks getFunction',             () => blocked('frame.getFunction()'));
    it('blocks getThis',                 () => blocked('frame.getThis()'));
    it('blocks __defineGetter__',        () => blocked('obj.__defineGetter__("foo", fn)'));
    it('blocks __defineSetter__',        () => blocked('obj.__defineSetter__("foo", fn)'));
    it('blocks __lookupGetter__',        () => blocked('obj.__lookupGetter__("foo")'));
    it('blocks __lookupSetter__',        () => blocked('obj.__lookupSetter__("foo")'));
    it('blocks defineProperty',          () => blocked('Object.defineProperty(obj, "key", desc)'));
    it('blocks defineProperties',        () => blocked('Object.defineProperties(obj, descs)'));
    it('blocks getOwnPropertyDescriptor',  () => blocked('Object.getOwnPropertyDescriptor(obj, "key")'));
    it('blocks getOwnPropertyDescriptors', () => blocked('Object.getOwnPropertyDescriptors(obj)'));
  });

  describe('blocked properties — bracket notation', () => {
    it('blocks constructor',       () => blocked('obj["constructor"]'));
    it('blocks __proto__',         () => blocked('obj["__proto__"]'));
    it('blocks prototype',         () => blocked('Promise["prototype"]'));
    it('blocks prepareStackTrace', () => blocked('Error["prepareStackTrace"]'));
    it('blocks captureStackTrace', () => blocked('Error["captureStackTrace"]'));
    it('blocks defineProperty',    () => blocked('Object["defineProperty"](obj, "key", desc)'));
  });

  // ---------------------------------------------------------------------------
  // Blocked roots
  // ---------------------------------------------------------------------------

  describe('blocked roots — direct member access', () => {
    it('blocks this',       () => blocked('this.x'));
    it('blocks globalThis', () => blocked('globalThis.require'));
    it('blocks global',     () => blocked('global.require'));
    it('blocks window',     () => blocked('window.process'));
    it('blocks self',       () => blocked('self.process'));
    it('blocks frames',     () => blocked('frames[0]'));
    it('blocks process',    () => blocked('process.env'));
    it('blocks module',     () => blocked('module.exports'));
    it('blocks exports',    () => blocked('exports.foo'));
    it('blocks Buffer',     () => blocked('Buffer.from("data")'));
    it('blocks arguments',  () => blocked('arguments[0]'));
  });

  describe('blocked roots — direct call', () => {
    it('blocks constructor called directly', () =>
      blocked('constructor("return process")()'));
  });

  describe('blocked roots — bracket notation', () => {
    it('blocks globalThis["require"]', () => blocked('globalThis["require"]()'));
    it('blocks window["process"]',     () => blocked('window["process"]'));
    it('blocks self["require"]',       () => blocked('self["require"]'));
    it('blocks process["env"]',        () => blocked('process["env"]'));
  });

  // ---------------------------------------------------------------------------
  // Alias chains and destructuring
  // ---------------------------------------------------------------------------

  describe('this — alias chains and destructuring', () => {
    it('blocks this.process.mainModule.require via member', () =>
      blocked(`this.process.mainModule.require('child_process')`));

    it('blocks this["process"]', () =>
      blocked(`this['process']`));

    it('blocks dynamic key on this', () =>
      blocked(`const k = 'process'; this[k]`));

    it('blocks const alias: const t = this; t.process', () =>
      blocked(`const t = this; t.process.mainModule.require('child_process')`));

    it('blocks assignment alias: let t; t = this; t.process', () =>
      blocked(`let t; t = this; t.process.mainModule.require('child_process')`));

    it('blocks destructuring from this', () =>
      blocked(`const { process } = this`));

    it('blocks destructuring assignment from this', () =>
      blocked(`({ process } = this)`));
  });

  describe('globalThis — alias chains and destructuring', () => {
    it('blocks const alias: const g = globalThis; g.require', () =>
      blocked(`const g = globalThis; g.require('child_process')`));

    it('blocks destructuring from globalThis', () =>
      blocked(`const { require } = globalThis`));

    it('blocks destructuring assignment from globalThis', () =>
      blocked(`({ require } = globalThis)`));
  });

  // ---------------------------------------------------------------------------
  // Prototype chain mutation
  // ---------------------------------------------------------------------------

  describe('prototype chain mutation', () => {
    it('blocks Promise.prototype.then mutation', () =>
      blocked(`Promise.prototype.then = function(fn) { fn.call(globalThis); }`));

    it('blocks Promise.prototype.catch mutation', () =>
      blocked(`Promise.prototype.catch = function() {}`));

    it('blocks Array.prototype.map mutation', () =>
      blocked(`Array.prototype.map = function() {}`));

    it('blocks Function.prototype.call mutation', () =>
      blocked(`Function.prototype.call = function() {}`));

    it('blocks reading Promise.prototype', () =>
      blocked(`const proto = Promise.prototype`));

    it('blocks bracket notation on Promise.prototype', () =>
      blocked(`Promise['prototype']`));
  });

  // ---------------------------------------------------------------------------
  // Dynamic import
  // ---------------------------------------------------------------------------

  describe('import', () => {
    it('blocks dynamic import()', () =>
      blocked(`import('child_process')`));

    it('blocks dynamic import() with variable', () =>
      blocked(`const m = 'child_process'; import(m)`));

    it('blocks static import declaration', () =>
      blocked(`import fs from 'fs'`));

    it('blocks static import with named exports', () =>
      blocked(`import { readFile } from 'fs'`));
  });

  // ---------------------------------------------------------------------------
  // Symbol.species
  // ---------------------------------------------------------------------------

  describe('Symbol.species', () => {
    it('blocks Symbol.species', () =>
      blocked(`Symbol.species`));
  });

  // ---------------------------------------------------------------------------
  // Unblocking — disabling a rule must allow previously blocked scripts
  // ---------------------------------------------------------------------------

  describe('unblocking — disabling a blocked property rule allows the script', () => {
    const cases: [name: string, script: string][] = [
      ['prototype',                'Promise.prototype.then'],
      ['mainModule',               'proc.mainModule'],
      ['constructor',              'obj.constructor'],
      ['__proto__',                'obj.__proto__'],
      ['prepareStackTrace',        'Error.prepareStackTrace'],
      ['captureStackTrace',        'Error.captureStackTrace'],
      ['getPrototypeOf',           'Object.getPrototypeOf(target)'],
      ['setPrototypeOf',           'Object.setPrototypeOf(obj, null)'],
      ['getFunction',              'frame.getFunction()'],
      ['getThis',                  'frame.getThis()'],
      ['__defineGetter__',         'obj.__defineGetter__("foo", fn)'],
      ['__defineSetter__',         'obj.__defineSetter__("foo", fn)'],
      ['__lookupGetter__',         'obj.__lookupGetter__("foo")'],
      ['__lookupSetter__',         'obj.__lookupSetter__("foo")'],
      ['defineProperty',           'Object.defineProperty(obj, "key", desc)'],
      ['defineProperties',         'Object.defineProperties(obj, descs)'],
      ['getOwnPropertyDescriptor', 'Object.getOwnPropertyDescriptor(obj, "key")'],
      ['getOwnPropertyDescriptors','Object.getOwnPropertyDescriptors(obj)'],
    ];

    for (const [name, script] of cases) {
      it(`disabling '${name}' allows: ${script}`, () =>
        expect(check(script, withoutProperty(name))).not.toThrow());
    }
  });

  describe('unblocking — disabling a blocked root rule allows the script', () => {
    const cases: [name: string, script: string][] = [
      ['this',        'this.x'],
      ['globalThis',  'globalThis.require'],
      ['global',      'global.require'],
      ['window',      'window.process'],
      ['self',        'self.process'],
      ['frames',      'frames[0]'],
      ['process',     'process.env'],
      ['module',      'module.exports'],
      ['exports',     'exports.foo'],
      ['Buffer',      'Buffer.from("data")'],
      ['constructor', 'constructor("return process")()'],
      ['arguments',   'arguments[0]'],
    ];

    for (const [name, script] of cases) {
      it(`disabling '${name}' allows: ${script}`, () =>
        expect(check(script, ALL_BLOCKED_PROPERTIES, withoutRoot(name))).not.toThrow());
    }

    it('disabling this also allows const aliases of this', () =>
      expect(check('const t = this; t.x', ALL_BLOCKED_PROPERTIES, withoutRoot('this'))).not.toThrow());

    it('disabling globalThis also allows const aliases of globalThis', () =>
      expect(check('const g = globalThis; g.require', ALL_BLOCKED_PROPERTIES, withoutRoot('globalThis'))).not.toThrow());
  });

  // ---------------------------------------------------------------------------
  // Dynamic computed property access (fail-closed policy)
  // ---------------------------------------------------------------------------

  describe('unresolvable dynamic computed properties', () => {
    it('blocks concatenated string key: obj["con"+"structor"]', () =>
      blocked(`obj["con"+"structor"]`));

    it('blocks variable key: const k = "constructor"; obj[k]', () =>
      blocked(`const k = "constructor"; obj[k]`));

    it('blocks unverifiable computed key: obj[someExpr]', () =>
      blocked(`obj[someExpr]`));

    it('blocks template literal with expressions: obj[`${x}`]', () =>
      blocked('obj[`${x}`]'));
  });

  // ---------------------------------------------------------------------------
  // Blocked properties with dynamic computed access (now fixed)
  // ---------------------------------------------------------------------------

  describe('blocked properties via computed access (BYPASS-1, BYPASS-2)', () => {
    it('blocks constructor via template literal: obj[`constructor`]', () =>
      blocked('obj[`constructor`]'));

    it('blocks constructor via concatenation: obj["con"+"structor"]', () =>
      blocked('obj["con"+"structor"]'));

    it('blocks AsyncFunction constructor via template: (async()=>{})[`constructor`]', () =>
      blocked('(async()=>{})[`constructor`]'));
  });

  // ---------------------------------------------------------------------------
  // Allowed scripts
  // ---------------------------------------------------------------------------

  describe('allowed scripts', () => {
    it('allows normal variable declarations', () =>
      allowed(`const x = 1 + 2`));

    it('allows require() calls', () =>
      allowed(`require('lodash')`));

    it('allows insomnia API usage', () =>
      allowed(`insomnia.environment.set('key', 'val')`));

    it('allows async/await', () =>
      allowed(`const res = await insomnia.sendRequest('https://example.com')`));

    it('allows pm.test()', () =>
      allowed(`pm.test('status is 200', () => { pm.expect(pm.response.code).to.equal(200); })`));

    it('allows lodash usage', () =>
      allowed(`const val = _.get(obj, 'foo.bar')`));

    it('allows console.log', () =>
      allowed(`console.log('hello')`));

    it('allows safe property access via string literal', () =>
      allowed(`obj['foo']`));

    it('allows safe property access via dot notation', () =>
      allowed(`obj.foo`));
  });

  describe('scriptBlockUnresolvableProperties toggle', () => {
    it('allows concatenated string key when block-dynamic is off', () =>
      expect(checkNoDynamic('obj["con"+"structor"]')).not.toThrow());

    it('allows identifier variable key when block-dynamic is off', () =>
      expect(checkNoDynamic('obj[someVar]')).not.toThrow());

    it('allows template literal with expression when block-dynamic is off', () =>
      expect(checkNoDynamic('obj[`${x}`]')).not.toThrow());

    it('still blocks a static string literal with a blocked name even when block-dynamic is off', () =>
      expect(checkNoDynamic('obj["constructor"]')).toThrow());

    it('still blocks a no-expression template literal with a blocked name even when block-dynamic is off', () =>
      expect(checkNoDynamic('obj[`constructor`]')).toThrow());
  });

  // ---------------------------------------------------------------------------
  // PoC bypasses: function wrapper to escape AST alias tracking
  // These scripts pass the AST check (documented vulnerability).
  // They are blocked at runtime by masking the identifiers in maskRules.
  // ---------------------------------------------------------------------------

  describe('PoC: function wrapper bypasses for module/self (blocked by runtime masking in maskRules)', () => {
    it('passes AST check for module indirection (PoC): const getModule = function() { return module; };', () => {
      allowed(`
        const getModule = function() { return module; };
        const m = getModule();
        m.require('child_process');
      `);
    });

    it('passes AST check for self indirection (PoC): const getSelf = function() { return self; };', () => {
      allowed(`
        const getSelf = function() { return self; };
        const w = getSelf();
        w.require('child_process');
      `);
    });

    it('passes AST check for exports indirection (PoC)', () => {
      allowed(`
        const getExports = function() { return exports; };
        const e = getExports();
        e.foo = 'bar';
      `);
    });

    it('passes AST check for Buffer indirection (PoC)', () => {
      allowed(`
        const getBuf = function() { return Buffer; };
        const b = getBuf();
        b.allocUnsafe(256);
      `);
    });

    it('passes AST check for frames indirection (PoC)', () => {
      allowed(`
        const getFrames = function() { return frames; };
        const f = getFrames();
        f[0];
      `);
    });
  });

  describe('PoC: AsyncFunction constructor via blockDynamic=false', () => {
    it('blocks AsyncFunction constructor with blockDynamic=true (default)', () => {
      expect(() => checkSandboxViolations(
        `(async () => {})['con' + 'structor']`,
        ALL_BLOCKED_PROPERTIES,
        ALL_BLOCKED_ROOTS,
        true
      )).toThrow();
    });

    it('allows AsyncFunction constructor access when blockDynamic=false', () => {
      expect(() => checkSandboxViolations(
        `(async () => {})['con' + 'structor']`,
        ALL_BLOCKED_PROPERTIES,
        ALL_BLOCKED_ROOTS,
        false
      )).not.toThrow();
    });
  });
});
