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

describe('checkSandboxViolations', () => {

  describe('properties: dot', () => {
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

  describe('properties: bracket', () => {
    it('blocks constructor',       () => blocked('obj["constructor"]'));
    it('blocks __proto__',         () => blocked('obj["__proto__"]'));
    it('blocks prototype',         () => blocked('Promise["prototype"]'));
    it('blocks prepareStackTrace', () => blocked('Error["prepareStackTrace"]'));
    it('blocks captureStackTrace', () => blocked('Error["captureStackTrace"]'));
    it('blocks defineProperty',    () => blocked('Object["defineProperty"](obj, "key", desc)'));
  });

  describe('roots: member', () => {
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

  describe('roots: call', () => {
    it('blocks constructor called directly', () =>
      blocked('constructor("return process")()'));

    it('blocks globalThis called directly', () =>
      blocked('globalThis()'));

    it('blocks aliased constructor call', () =>
      blocked('const c = constructor; c("return process")()'));
  });

  describe('roots: bracket', () => {
    it('blocks globalThis["require"]', () => blocked('globalThis["require"]()'));
    it('blocks window["process"]',     () => blocked('window["process"]'));
    it('blocks self["require"]',       () => blocked('self["require"]'));
    it('blocks process["env"]',        () => blocked('process["env"]'));
  });

  describe('this: aliases & destructuring', () => {
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

  describe('globalThis: aliases & destructuring', () => {
    it('blocks const alias: const g = globalThis; g.require', () =>
      blocked(`const g = globalThis; g.require('child_process')`));

    it('blocks destructuring from globalThis', () =>
      blocked(`const { require } = globalThis`));

    it('blocks destructuring assignment from globalThis', () =>
      blocked(`({ require } = globalThis)`));

    it('blocks renamed destructuring from globalThis', () =>
      blocked(`const { require: r } = globalThis`));

    it('blocks alias init via LogicalExpression', () =>
      blocked(`const g = null || globalThis; g.require('child_process')`));

    it('blocks alias init via ConditionalExpression', () =>
      blocked(`const g = cond ? globalThis : null; g.require('child_process')`));

    it('blocks alias init via SequenceExpression', () =>
      blocked(`const g = (0, globalThis); g.require('child_process')`));

    it('blocks transitive alias (alias of alias)', () =>
      blocked(`const a = globalThis; const b = a; b.require('child_process')`));

    it('blocks assignment alias via LogicalExpression', () =>
      blocked(`let g; g = false || globalThis; g.require('child_process')`));

    it('blocks computed property on aliased root', () =>
      blocked(`const g = globalThis; g["require"]`));

    it('blocks blocked root used deep inside an assignment RHS', () =>
      blocked(`a.b.c = globalThis.process`));
  });

  describe('prototype mutation', () => {
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

  describe('Symbol.species', () => {
    it('blocks Symbol.species', () =>
      blocked(`Symbol.species`));

    it('blocks Symbol["species"]', () =>
      blocked(`Symbol['species']`));
  });

  describe('unblocking: properties', () => {
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

  describe('unblocking: roots', () => {
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

  describe('dynamic computed keys', () => {
    it('blocks concatenated string key: obj["con"+"structor"]', () =>
      blocked(`obj["con"+"structor"]`));

    it('blocks variable key: const k = "constructor"; obj[k]', () =>
      blocked(`const k = "constructor"; obj[k]`));

    it('blocks unverifiable computed key: obj[someExpr]', () =>
      blocked(`obj[someExpr]`));

    it('blocks template literal with expressions: obj[`${x}`]', () =>
      blocked('obj[`${x}`]'));
  });

  describe('blocked properties via computed access', () => {
    it('blocks constructor via template literal: obj[`constructor`]', () =>
      blocked('obj[`constructor`]'));

    it('blocks constructor via concatenation: obj["con"+"structor"]', () =>
      blocked('obj["con"+"structor"]'));

    it('blocks AsyncFunction constructor via template: (async()=>{})[`constructor`]', () =>
      blocked('(async()=>{})[`constructor`]'));
  });

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

    it('allows arrow functions and closures', () =>
      allowed(`const add = (a, b) => a + b; add(1, 2)`));

    it('allows class declarations and instantiation', () =>
      allowed(`class Foo { greet() { return 'hi' } } new Foo().greet()`));

    it('allows spread and rest', () =>
      allowed(`const a = [1, 2]; const b = [...a, 3]; const fn = (...args) => args.length`));

    it('allows optional chaining on user objects', () =>
      allowed(`const x = obj?.foo?.bar`));

    it('allows nullish coalescing', () =>
      allowed(`const x = a ?? b`));

    it('allows destructuring user objects and arrays', () =>
      allowed(`const { a, b } = data; const [first] = list`));

    it('allows template literals', () =>
      allowed('const s = `hello ${name}`'));

    it('allows try/catch/finally', () =>
      allowed(`try { doThing() } catch (e) { console.log(e) } finally { cleanup() }`));

    it('allows for-of loops', () =>
      allowed(`for (const item of items) { console.log(item) }`));

    it('allows JSON.parse / JSON.stringify', () =>
      allowed(`JSON.parse(JSON.stringify({ a: 1 }))`));

    it('allows Promise chains', () =>
      allowed(`Promise.resolve(1).then(v => v + 1)`));

    it('allows Math / Date / Number / String built-ins', () =>
      allowed(`Math.max(1, Date.now()); Number('3'); String(1)`));

    it('allows Array methods', () =>
      allowed(`[1, 2, 3].map(x => x * 2).filter(x => x > 1)`));

    it('allows regex literals', () =>
      allowed(`const re = /foo/g; 'foobar'.match(re)`));

    it('allows common pm patterns', () =>
      allowed(`pm.environment.set('k', 'v'); pm.variables.get('k')`));

    it('allows common insomnia patterns', () =>
      allowed(`insomnia.request.headers.add({ key: 'X', value: '1' })`));
  });

  describe('blockDynamic=false toggle', () => {
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

  // These scripts intentionally pass AST checks; runtime masking in maskRules catches them.
  describe('function-wrapper indirection (AST-pass, runtime-masked)', () => {
    it('module indirection via function wrapper', () => {
      allowed(`
        const getModule = function() { return module; };
        const m = getModule();
        m.require('child_process');
      `);
    });

    it('self indirection via function wrapper', () => {
      allowed(`
        const getSelf = function() { return self; };
        const w = getSelf();
        w.require('child_process');
      `);
    });

    it('exports indirection via function wrapper', () => {
      allowed(`
        const getExports = function() { return exports; };
        const e = getExports();
        e.foo = 'bar';
      `);
    });

    it('Buffer indirection via function wrapper', () => {
      allowed(`
        const getBuf = function() { return Buffer; };
        const b = getBuf();
        b.allocUnsafe(256);
      `);
    });

    it('frames indirection via function wrapper', () => {
      allowed(`
        const getFrames = function() { return frames; };
        const f = getFrames();
        f[0];
      `);
    });
  });

  describe('AsyncFunction constructor via computed access', () => {
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
