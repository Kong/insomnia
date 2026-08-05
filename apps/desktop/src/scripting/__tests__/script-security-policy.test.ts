import { describe, expect, it } from 'vitest';

import { requireInterceptor } from '../require-interceptor';
import { defaultSecurityPolicy } from '../sandbox';
import { interceptorRules, maskRules } from '../script-security-policy';

// Build the mask map once — shared across all tests.
const { names, values } = defaultSecurityPolicy.buildMaskScope();
const maskMap = new Map(names.map((name, i) => [name, values[i]]));

describe('ScriptSecurityPolicy.buildMaskScope()', () => {
  describe('coverage — every rule with a maskName is present', () => {
    it('includes all interceptor rule mask names', () => {
      for (const rule of interceptorRules) {
        if (rule.maskName) {
          expect(names, `missing mask for interceptor rule "${rule.name}"`).toContain(rule.maskName);
        }
      }
    });

    it('includes all mask rule names', () => {
      for (const rule of maskRules) {
        if (rule.maskName) {
          expect(names, `missing mask for mask rule "${rule.name}"`).toContain(rule.maskName);
        }
      }
    });
  });

  describe('mask rules — blocked globals resolve to undefined', () => {
    const undefinedMasks = [
      'globalThis',
      'global',
      'Function',
      'process',
      'setImmediate',
      'queueMicrotask',
      'Proxy',
      'Reflect',
      'WebAssembly',
    ];

    for (const name of undefinedMasks) {
      it(`${name} → undefined`, () => {
        expect(maskMap.has(name)).toBe(true);
        expect(maskMap.get(name)).toBeUndefined();
      });
    }
  });

  describe('require interceptor', () => {
    it('masks require with requireInterceptor', () => {
      expect(maskMap.get('require')).toBe(requireInterceptor);
    });
  });

  describe('window allowlist', () => {
    // In Vitest's Node environment window is undefined, so the rule returns undefined.
    it('masks window to undefined in Node environment', () => {
      expect(maskMap.has('window')).toBe(true);
      expect(maskMap.get('window')).toBeUndefined();
    });
  });

  describe('eval interceptor', () => {
    const evalFn = maskMap.get('eval') as (script: string) => unknown;

    it('is a function', () => {
      expect(typeof evalFn).toBe('function');
    });

    it('throws on null input', () => {
      expect(() => (evalFn as any)(null)).toThrow();
    });

    it('throws on non-string input', () => {
      expect(() => (evalFn as any)(42)).toThrow();
    });

    describe('blocks AST violations smuggled through eval', () => {
      it('blocks dynamic import()', () => {
        expect(() => evalFn('import("child_process")')).toThrow();
      });

      it('blocks globalThis access', () => {
        expect(() => evalFn('globalThis.process')).toThrow();
      });

      it('blocks constructor access', () => {
        expect(() => evalFn('obj.constructor')).toThrow();
      });

      it('blocks __proto__ access', () => {
        expect(() => evalFn('obj.__proto__')).toThrow();
      });

      it('blocks prototype access', () => {
        expect(() => evalFn('Promise.prototype')).toThrow();
      });

      it('blocks setPrototypeOf access', () => {
        expect(() => evalFn('Object.setPrototypeOf(obj, null)')).toThrow();
      });

      it('blocks captureStackTrace access', () => {
        expect(() => evalFn('Error.captureStackTrace(obj)')).toThrow();
      });

      it('blocks defineProperty access', () => {
        expect(() => evalFn('Object.defineProperty(obj, "key", {})')).toThrow();
      });
    });

    describe('allows safe eval', () => {
      it('evaluates arithmetic', () => {
        expect(evalFn('1 + 1')).toBe(2);
      });

      it('evaluates string expressions', () => {
        expect(evalFn('"hello"')).toBe('hello');
      });
    });
  });
});

describe('ScriptSecurityPolicy builders', () => {
  describe('withoutRule()', () => {
    it('removes a rule by name', () => {
      const policy = defaultSecurityPolicy.withoutRule('process');
      const { names } = policy.buildMaskScope();
      expect(names).not.toContain('process');
    });

    it('leaves other rules intact', () => {
      const policy = defaultSecurityPolicy.withoutRule('process');
      const { names } = policy.buildMaskScope();
      expect(names).toContain('globalThis');
    });

    it('is a no-op for an unknown rule name', () => {
      const before = defaultSecurityPolicy.buildMaskScope().names.length;
      const after = defaultSecurityPolicy.withoutRule('nonexistent').buildMaskScope().names.length;
      expect(after).toBe(before);
    });

    it('can remove each mask rule individually', () => {
      for (const rule of maskRules) {
        const policy = defaultSecurityPolicy.withoutRule(rule.name);
        const { names } = policy.buildMaskScope();
        if (rule.maskName) {
          expect(names, `rule '${rule.name}' was not removed`).not.toContain(rule.maskName);
        }
      }
    });

    it('can remove each interceptor rule individually', () => {
      for (const rule of interceptorRules) {
        const policy = defaultSecurityPolicy.withoutRule(rule.name);
        const { names } = policy.buildMaskScope();
        if (rule.maskName) {
          expect(names, `rule '${rule.name}' was not removed`).not.toContain(rule.maskName);
        }
      }
    });
  });

  describe('withRule()', () => {
    it('appends a new mask rule', () => {
      const policy = defaultSecurityPolicy.withRule({
        name: 'custom-mask',
        description: 'test rule',
        maskName: 'customGlobal',
        maskValue: undefined,
      });
      const { names } = policy.buildMaskScope();
      expect(names).toContain('customGlobal');
    });

    it('does not mutate the original policy', () => {
      defaultSecurityPolicy.withRule({
        name: 'custom-mask',
        description: 'test rule',
        maskName: 'customGlobal',
        maskValue: undefined,
      });
      const { names } = defaultSecurityPolicy.buildMaskScope();
      expect(names).not.toContain('customGlobal');
    });
  });
});
