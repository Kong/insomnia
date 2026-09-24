import nodeAssert from 'node:assert';

import { describe, expect, it } from 'vitest';

import { type HostBridge } from './host-bridge';
import { type ContextEnvelope } from './marshal';
import { runTagInSandbox } from './plugin-tag-sandbox';

// Regression suite for the pure-JS `assert` reimplementation. Behavioral/API tests exercise the
// sandboxed module directly; the parity suite runs the same operation through real `node:assert` as
// ground truth and checks the sandboxed version reaches the same pass/fail outcome and, where the
// module throws, the same actual/expected/operator shape (exact message wording is not asserted —
// see the gap noted in PERMISSIONS.md).
const noBridge: HostBridge = async bridgePath => {
  throw new Error(`unexpected bridge call: ${bridgePath}`);
};

const envelope = (grantedModules: string[]): ContextEnvelope => ({
  args: [],
  context: {},
  meta: {},
  renderPurpose: 'preview',
  appInfo: { version: '0.0.0', platform: 'linux', arch: 'x64' },
  pluginName: 'test-plugin',
  renderDepth: 0,
  grantedModules,
  grantedCapabilities: [],
});

const runAssertTag = (body: string) =>
  runTagInSandbox({
    pluginSource: `module.exports.templateTags = [{ name: 't', run: function () {
      var assert = require('assert');
      ${body}
    } }];`,
    tagName: 't',
    envelope: envelope(['path', 'crypto', 'assert']),
    bridge: noBridge,
  });

// Runs `body` (an expression using `assert`) against both real node:assert and the sandboxed one,
// capturing pass/fail + error shape from each side identically.
const captureOutcome = (assertBody: string) => `
  try {
    ${assertBody}
    return JSON.stringify({ threw: false });
  } catch (e) {
    return JSON.stringify({
      threw: true,
      name: e.name,
      message: e.message,
      actual: e.actual === undefined ? null : e.actual,
      expected: e.expected === undefined ? null : e.expected,
      operator: e.operator === undefined ? null : e.operator,
      isError: e instanceof Error,
      isAssertionError: e instanceof assert.AssertionError,
    });
  }
`;

// Round-trips actual/expected through JSON exactly like the sandbox-side `captureOutcome` does, so an
// Error operand (whose message/stack are non-enumerable) collapses to `{}` identically on both sides
// instead of comparing a JSON `{}` against a live Error instance.
// Must reproduce JSON's lossy encoding (drops non-enumerable Error props), not a faithful clone —
// structuredClone would preserve them, defeating the comparison.
// eslint-disable-next-line unicorn/prefer-structured-clone
const jsonRoundTrip = (value: unknown) => JSON.parse(JSON.stringify(value === undefined ? null : value));

const nodeOutcome = (fn: () => void) => {
  try {
    fn();
    return { threw: false as const };
  } catch (e) {
    const err = e as { name?: string; actual?: unknown; expected?: unknown; operator?: string };
    return {
      threw: true as const,
      name: err.name ?? null,
      actual: jsonRoundTrip(err.actual),
      expected: jsonRoundTrip(err.expected),
      operator: err.operator ?? null,
      isError: e instanceof Error,
      isAssertionError: e instanceof nodeAssert.AssertionError,
    };
  }
};

describe('assert regression suite', () => {
  describe('behavior', () => {
    it('ok() and the callable form pass on truthy, throw on falsy', async () => {
      await expect(runAssertTag('assert.ok(1); assert(true); return "pass";')).resolves.toBe('pass');
      await expect(runAssertTag('assert.ok(0);')).rejects.toThrow();
      await expect(runAssertTag('assert(false);')).rejects.toThrow();
    });

    it('equal/notEqual use loose comparison', async () => {
      await expect(runAssertTag('assert.equal(1, "1"); return "pass";')).resolves.toBe('pass');
      await expect(runAssertTag('assert.notEqual(1, 2); return "pass";')).resolves.toBe('pass');
      await expect(runAssertTag('assert.equal(1, 2);')).rejects.toThrow();
    });

    it('strictEqual/notStrictEqual use strict comparison', async () => {
      await expect(runAssertTag('assert.strictEqual(1, 1); return "pass";')).resolves.toBe('pass');
      await expect(runAssertTag('assert.strictEqual(1, "1");')).rejects.toThrow();
      await expect(runAssertTag('assert.notStrictEqual(1, "1"); return "pass";')).resolves.toBe('pass');
    });

    it('deepEqual is loose and structural; deepStrictEqual also checks type/prototype', async () => {
      await expect(runAssertTag('assert.deepEqual({ a: 1 }, { a: "1" }); return "pass";')).resolves.toBe('pass');
      await expect(runAssertTag('assert.deepStrictEqual({ a: 1 }, { a: "1" });')).rejects.toThrow();
      await expect(
        runAssertTag('assert.deepStrictEqual({ a: 1, b: [1, 2, { c: 3 }] }, { a: 1, b: [1, 2, { c: 3 }] }); return "pass";'),
      ).resolves.toBe('pass');
      await expect(runAssertTag('assert.notDeepStrictEqual({ a: 1 }, { a: 2 }); return "pass";')).resolves.toBe('pass');
    });

    it('deepStrictEqual handles circular structures without overflowing', async () => {
      const result = await runAssertTag(`
        var a = { x: 1 }; a.self = a;
        var b = { x: 1 }; b.self = b;
        assert.deepStrictEqual(a, b);
        return "pass";
      `);
      expect(result).toBe('pass');
    });

    it('deepEqual/deepStrictEqual throw an explicit error for Map/Set/TypedArray operands', async () => {
      await expect(runAssertTag('assert.deepStrictEqual(new Map(), new Map());')).rejects.toThrow(/not supported/);
      await expect(runAssertTag('assert.deepStrictEqual(new Set(), new Set());')).rejects.toThrow(/not supported/);
      await expect(runAssertTag('assert.deepStrictEqual(new Uint8Array([1]), new Uint8Array([1]));')).rejects.toThrow(/not supported/);
    });

    it('deepEqual/deepStrictEqual throw an explicit error for Symbol-keyed properties', async () => {
      await expect(
        runAssertTag('var s = Symbol("k"); var a = {}; a[s] = 1; var b = {}; b[s] = 1; assert.deepStrictEqual(a, b);'),
      ).rejects.toThrow(/not supported/);
    });

    it('deepEqual/deepStrictEqual still throw for a Map/Set disguised behind a Proxy that only spoofs Symbol.toStringTag', async () => {
      // Object.prototype.toString's tag alone is not a reliable brand check: a Proxy can report a
      // spoofed Symbol.toStringTag for a real Map/Set/WeakMap/WeakSet/ArrayBuffer while leaving every
      // other operation (including its prototype chain) untouched, which would otherwise make two
      // Maps/Sets with entirely different entries compare as "equal" with no throw at all — silently
      // wrong, the exact outcome this module's explicit throw exists to prevent. A bare-`instanceof`
      // check (unaffected by a toStringTag-only spoof) closes this specific bypass; a Proxy that also
      // fakes its prototype chain via a `getPrototypeOf` trap is a documented residual gap.
      const wrapProxy = 'function (v) { return new Proxy(v, { get: function (t, p, r) { return p === Symbol.toStringTag ? "Object" : Reflect.get(t, p, r); } }); }';
      await expect(
        runAssertTag(`
          var wrap = ${wrapProxy};
          assert.deepStrictEqual(wrap(new Map([["k", "left"]])), wrap(new Map([["k", "right"]])));
        `),
      ).rejects.toThrow(/not supported/);
      await expect(
        runAssertTag(`
          var wrap = ${wrapProxy};
          assert.deepStrictEqual(wrap(new Set(["left"])), wrap(new Set(["right"])));
        `),
      ).rejects.toThrow(/not supported/);
      await expect(
        runAssertTag(`
          var wrap = ${wrapProxy};
          assert.deepStrictEqual({ nested: wrap(new Map([["k", "left"]])) }, { nested: wrap(new Map([["k", "right"]])) });
        `),
      ).rejects.toThrow(/not supported/);
    });

    it('ifError throws the value itself when not null/undefined', async () => {
      await expect(runAssertTag('assert.ifError(null); assert.ifError(undefined); return "pass";')).resolves.toBe('pass');
      await expect(runAssertTag('assert.ifError("boom");')).rejects.toThrow('boom');
    });

    it('fail(message) throws an AssertionError with that message', async () => {
      await expect(runAssertTag('assert.fail("boom");')).rejects.toThrow('boom');
    });

    it('throws()/doesNotThrow() match by constructor, RegExp, and validator function', async () => {
      const fnThrowsTypeError = 'function () { throw new TypeError("bad"); }';
      await expect(runAssertTag(`assert.throws(${fnThrowsTypeError}, TypeError); return "pass";`)).resolves.toBe('pass');
      await expect(runAssertTag(`assert.throws(${fnThrowsTypeError}, RangeError);`)).rejects.toThrow();
      await expect(runAssertTag(`assert.throws(${fnThrowsTypeError}, /bad/); return "pass";`)).resolves.toBe('pass');
      await expect(
        runAssertTag(`assert.throws(${fnThrowsTypeError}, function (e) { return e.message === "bad"; }); return "pass";`),
      ).resolves.toBe('pass');
      await expect(runAssertTag('assert.throws(function () {});')).rejects.toThrow('Missing expected exception');
      await expect(runAssertTag('assert.doesNotThrow(function () {}); return "pass";')).resolves.toBe('pass');
      await expect(runAssertTag(`assert.doesNotThrow(${fnThrowsTypeError});`)).rejects.toThrow();
    });

    it('AssertionError satisfies instanceof Error and instanceof AssertionError, and carries actual/expected/operator', async () => {
      const result = await runAssertTag(`
        try { assert.strictEqual(1, 2); } catch (e) {
          return JSON.stringify({
            isError: e instanceof Error,
            isAssertionError: e instanceof assert.AssertionError,
            name: e.name,
            actual: e.actual,
            expected: e.expected,
            operator: e.operator,
          });
        }
      `);
      expect(JSON.parse(result)).toEqual({
        isError: true,
        isAssertionError: true,
        name: 'AssertionError',
        actual: 1,
        expected: 2,
        operator: 'strictEqual',
      });
    });

    it('assert.strict uses strict comparisons for equal/deepEqual', async () => {
      await expect(runAssertTag('assert.equal(1, "1"); return "pass";')).resolves.toBe('pass');
      await expect(runAssertTag('assert.strict.equal(1, "1");')).rejects.toThrow();
      await expect(runAssertTag('assert.strict.deepEqual({ a: 1 }, { a: "1" });')).rejects.toThrow();
    });
  });

  describe('parity with real node:assert', () => {
    const cases: { label: string; assertBody: string; node: () => void }[] = [
      { label: 'equal(1, "1") passes', assertBody: 'assert.equal(1, "1");', node: () => nodeAssert.equal(1, '1' as unknown as number) },
      { label: 'equal(1, 2) fails', assertBody: 'assert.equal(1, 2);', node: () => nodeAssert.equal(1, 2) },
      { label: 'strictEqual(1, "1") fails', assertBody: 'assert.strictEqual(1, "1");', node: () => nodeAssert.strictEqual(1, '1' as unknown as number) },
      { label: 'strictEqual(1, 1) passes', assertBody: 'assert.strictEqual(1, 1);', node: () => nodeAssert.strictEqual(1, 1) },
      {
        label: 'deepStrictEqual on matching nested structures passes',
        assertBody: 'assert.deepStrictEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] });',
        node: () => nodeAssert.deepStrictEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }),
      },
      {
        label: 'deepStrictEqual on mismatched nested structures fails',
        assertBody: 'assert.deepStrictEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 3] });',
        node: () => nodeAssert.deepStrictEqual({ a: 1, b: [1, 2] }, { a: 1, b: [1, 3] }),
      },
      { label: 'ifError(null) passes', assertBody: 'assert.ifError(null);', node: () => nodeAssert.ifError(null) },
      {
        label: 'throws(fn, TypeError) passes when fn throws a TypeError',
        assertBody: 'assert.throws(function () { throw new TypeError("bad"); }, TypeError);',
        node: () => nodeAssert.throws(() => { throw new TypeError('bad'); }, TypeError),
      },
      {
        label: 'doesNotThrow(fn) fails when fn throws',
        assertBody: 'assert.doesNotThrow(function () { throw new Error("bad"); });',
        node: () => nodeAssert.doesNotThrow(() => { throw new Error('bad'); }),
      },
    ];

    it.each(cases)('$label — same pass/fail outcome and actual/expected/operator as real node:assert', async ({ assertBody, node }) => {
      const sandboxResult = JSON.parse(await runAssertTag(captureOutcome(assertBody)));
      const expected = nodeOutcome(node);
      expect(sandboxResult.threw).toBe(expected.threw);
      if (expected.threw && sandboxResult.threw) {
        expect(sandboxResult.name).toBe(expected.name);
        expect(sandboxResult.actual).toEqual(expected.actual);
        expect(sandboxResult.expected).toEqual(expected.expected);
        expect(sandboxResult.operator).toBe(expected.operator);
        expect(sandboxResult.isError).toBe(true);
        expect(sandboxResult.isAssertionError).toBe(expected.isAssertionError);
      }
    });
  });
});
