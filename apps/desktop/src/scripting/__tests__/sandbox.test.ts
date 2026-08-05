import { describe, expect, it } from 'vitest';

import { checkSandboxViolations } from '../sandbox';
import { blockedPropertyRules, blockedRootRules } from '../script-security-policy';

const ALL_BLOCKED_PROPERTIES = new Set(blockedPropertyRules.map(r => r.name));
const ALL_BLOCKED_ROOTS = new Set(blockedRootRules.map(r => r.name));

const check =
  (script: string, props = ALL_BLOCKED_PROPERTIES, roots = ALL_BLOCKED_ROOTS) =>
  () =>
    checkSandboxViolations(script, props, roots);

const blocked = (script: string) => expect(check(script)).toThrow();
const allowed = (script: string) => expect(check(script)).not.toThrow();

const withoutProperty = (name: string) => new Set([...ALL_BLOCKED_PROPERTIES].filter(p => p !== name));

const withoutRoot = (name: string) => new Set([...ALL_BLOCKED_ROOTS].filter(r => r !== name));

// ---------------------------------------------------------------------------
// Blocked properties — one canonical script per rule covering both dot and
// bracket notation where applicable. The unblocking section below mirrors
// each rule to confirm the disable path works too.
// ---------------------------------------------------------------------------

describe('checkSandboxViolations', () => {
  describe('blocked properties — dot notation', () => {
    it('blocks prototype', () => blocked('Promise.prototype.then'));
    it('blocks mainModule', () => blocked('proc.mainModule'));
    it('blocks constructor', () => blocked('obj.constructor'));
    it('blocks __proto__', () => blocked('obj.__proto__'));
    it('blocks prepareStackTrace', () => blocked('Error.prepareStackTrace'));
    it('blocks captureStackTrace', () => blocked('Error.captureStackTrace'));
    it('blocks getPrototypeOf', () => blocked('Object.getPrototypeOf(target)'));
    it('blocks setPrototypeOf', () => blocked('Object.setPrototypeOf(obj, null)'));
    it('blocks getFunction', () => blocked('frame.getFunction()'));
    it('blocks getThis', () => blocked('frame.getThis()'));
    it('blocks __defineGetter__', () => blocked('obj.__defineGetter__("foo", fn)'));
    it('blocks __defineSetter__', () => blocked('obj.__defineSetter__("foo", fn)'));
    it('blocks __lookupGetter__', () => blocked('obj.__lookupGetter__("foo")'));
    it('blocks __lookupSetter__', () => blocked('obj.__lookupSetter__("foo")'));
    it('blocks defineProperty', () => blocked('Object.defineProperty(obj, "key", desc)'));
    it('blocks defineProperties', () => blocked('Object.defineProperties(obj, descs)'));
    it('blocks getOwnPropertyDescriptor', () => blocked('Object.getOwnPropertyDescriptor(obj, "key")'));
    it('blocks getOwnPropertyDescriptors', () => blocked('Object.getOwnPropertyDescriptors(obj)'));
  });

  describe('blocked properties — bracket notation', () => {
    it('blocks constructor', () => blocked('obj["constructor"]'));
    it('blocks __proto__', () => blocked('obj["__proto__"]'));
    it('blocks prototype', () => blocked('Promise["prototype"]'));
    it('blocks prepareStackTrace', () => blocked('Error["prepareStackTrace"]'));
    it('blocks captureStackTrace', () => blocked('Error["captureStackTrace"]'));
    it('blocks defineProperty', () => blocked('Object["defineProperty"](obj, "key", desc)'));
  });

  // ---------------------------------------------------------------------------
  // Blocked roots
  // ---------------------------------------------------------------------------

  describe('blocked roots — direct member access', () => {
    it('blocks this', () => blocked('this.x'));
    it('blocks globalThis', () => blocked('globalThis.require'));
    it('blocks global', () => blocked('global.require'));
    it('blocks window', () => blocked('window.process'));
    it('blocks self', () => blocked('self.process'));
    it('blocks frames', () => blocked('frames[0]'));
    it('blocks process', () => blocked('process.env'));
    it('blocks module', () => blocked('module.exports'));
    it('blocks exports', () => blocked('exports.foo'));
    it('blocks Buffer', () => blocked('Buffer.from("data")'));
    it('blocks arguments', () => blocked('arguments[0]'));
  });

  describe('blocked roots — direct call', () => {
    it('blocks constructor called directly', () => blocked('constructor("return process")()'));
  });

  describe('blocked roots — bracket notation', () => {
    it('blocks globalThis["require"]', () => blocked('globalThis["require"]()'));
    it('blocks window["process"]', () => blocked('window["process"]'));
    it('blocks self["require"]', () => blocked('self["require"]'));
    it('blocks process["env"]', () => blocked('process["env"]'));
  });

  // ---------------------------------------------------------------------------
  // Alias chains and destructuring
  // ---------------------------------------------------------------------------

  describe('this — alias chains and destructuring', () => {
    it('blocks this.process.mainModule.require via member', () =>
      blocked(`this.process.mainModule.require('child_process')`));

    it('blocks this["process"]', () => blocked(`this['process']`));

    it('blocks dynamic key on this', () => blocked(`const k = 'process'; this[k]`));

    it('blocks const alias: const t = this; t.process', () =>
      blocked(`const t = this; t.process.mainModule.require('child_process')`));

    it('blocks assignment alias: let t; t = this; t.process', () =>
      blocked(`let t; t = this; t.process.mainModule.require('child_process')`));

    it('blocks destructuring from this', () => blocked(`const { process } = this`));

    it('blocks destructuring assignment from this', () => blocked(`({ process } = this)`));
  });

  describe('globalThis — alias chains and destructuring', () => {
    it('blocks const alias: const g = globalThis; g.require', () =>
      blocked(`const g = globalThis; g.require('child_process')`));

    it('blocks destructuring from globalThis', () => blocked(`const { require } = globalThis`));

    it('blocks destructuring assignment from globalThis', () => blocked(`({ require } = globalThis)`));
  });

  // ---------------------------------------------------------------------------
  // Prototype chain mutation
  // ---------------------------------------------------------------------------

  describe('prototype chain mutation', () => {
    it('blocks Promise.prototype.then mutation', () =>
      blocked(`Promise.prototype.then = function(fn) { fn.call(globalThis); }`));

    it('blocks Promise.prototype.catch mutation', () => blocked(`Promise.prototype.catch = function() {}`));

    it('blocks Array.prototype.map mutation', () => blocked(`Array.prototype.map = function() {}`));

    it('blocks Function.prototype.call mutation', () => blocked(`Function.prototype.call = function() {}`));

    it('blocks reading Promise.prototype', () => blocked(`const proto = Promise.prototype`));

    it('blocks bracket notation on Promise.prototype', () => blocked(`Promise['prototype']`));
  });

  // ---------------------------------------------------------------------------
  // Dynamic import
  // ---------------------------------------------------------------------------

  describe('import', () => {
    it('blocks dynamic import()', () => blocked(`import('child_process')`));

    it('blocks dynamic import() with variable', () => blocked(`const m = 'child_process'; import(m)`));

    it('blocks static import declaration', () => blocked(`import fs from 'fs'`));

    it('blocks static import with named exports', () => blocked(`import { readFile } from 'fs'`));
  });

  // ---------------------------------------------------------------------------
  // Symbol.species
  // ---------------------------------------------------------------------------

  describe('Symbol.species', () => {
    it('blocks Symbol.species', () => blocked(`Symbol.species`));
  });

  // ---------------------------------------------------------------------------
  // Unblocking — disabling a rule must allow previously blocked scripts
  // ---------------------------------------------------------------------------

  describe('unblocking — disabling a blocked property rule allows the script', () => {
    const cases: [name: string, script: string][] = [
      ['prototype', 'Promise.prototype.then'],
      ['mainModule', 'proc.mainModule'],
      ['constructor', 'obj.constructor'],
      ['__proto__', 'obj.__proto__'],
      ['prepareStackTrace', 'Error.prepareStackTrace'],
      ['captureStackTrace', 'Error.captureStackTrace'],
      ['getPrototypeOf', 'Object.getPrototypeOf(target)'],
      ['setPrototypeOf', 'Object.setPrototypeOf(obj, null)'],
      ['getFunction', 'frame.getFunction()'],
      ['getThis', 'frame.getThis()'],
      ['__defineGetter__', 'obj.__defineGetter__("foo", fn)'],
      ['__defineSetter__', 'obj.__defineSetter__("foo", fn)'],
      ['__lookupGetter__', 'obj.__lookupGetter__("foo")'],
      ['__lookupSetter__', 'obj.__lookupSetter__("foo")'],
      ['defineProperty', 'Object.defineProperty(obj, "key", desc)'],
      ['defineProperties', 'Object.defineProperties(obj, descs)'],
      ['getOwnPropertyDescriptor', 'Object.getOwnPropertyDescriptor(obj, "key")'],
      ['getOwnPropertyDescriptors', 'Object.getOwnPropertyDescriptors(obj)'],
    ];

    for (const [name, script] of cases) {
      it(`disabling '${name}' allows: ${script}`, () => expect(check(script, withoutProperty(name))).not.toThrow());
    }
  });

  describe('unblocking — disabling a blocked root rule allows the script', () => {
    const cases: [name: string, script: string][] = [
      ['this', 'this.x'],
      ['globalThis', 'globalThis.require'],
      ['global', 'global.require'],
      ['window', 'window.process'],
      ['self', 'self.process'],
      ['frames', 'frames[0]'],
      ['process', 'process.env'],
      ['module', 'module.exports'],
      ['exports', 'exports.foo'],
      ['Buffer', 'Buffer.from("data")'],
      ['constructor', 'constructor("return process")()'],
      ['arguments', 'arguments[0]'],
    ];

    for (const [name, script] of cases) {
      it(`disabling '${name}' allows: ${script}`, () =>
        expect(check(script, ALL_BLOCKED_PROPERTIES, withoutRoot(name))).not.toThrow());
    }

    it('disabling this also allows const aliases of this', () =>
      expect(check('const t = this; t.x', ALL_BLOCKED_PROPERTIES, withoutRoot('this'))).not.toThrow());

    it('disabling globalThis also allows const aliases of globalThis', () =>
      expect(
        check('const g = globalThis; g.require', ALL_BLOCKED_PROPERTIES, withoutRoot('globalThis')),
      ).not.toThrow());
  });

  // ---------------------------------------------------------------------------
  // Allowed scripts
  // ---------------------------------------------------------------------------

  describe('allowed scripts', () => {
    it('allows normal variable declarations', () => allowed(`const x = 1 + 2`));

    it('allows require() calls', () => allowed(`require('lodash')`));

    it('allows insomnia API usage', () => allowed(`insomnia.environment.set('key', 'val')`));

    it('allows async/await', () => allowed(`const res = await insomnia.sendRequest('https://example.com')`));

    it('allows pm.test()', () =>
      allowed(`pm.test('status is 200', () => { pm.expect(pm.response.code).to.equal(200); })`));

    it('allows lodash usage', () => allowed(`const val = _.get(obj, 'foo.bar')`));

    it('allows console.log', () => allowed(`console.log('hello')`));

    it('allows class with prototype-like property name in string', () => allowed(`const key = 'prototype'; obj[key]`));
  });
});
