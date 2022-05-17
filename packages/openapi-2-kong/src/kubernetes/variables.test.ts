import { describe, expect, it } from '@jest/globals';

import { OA3ServerVariable } from '../types/openapi3';
import { pathVariablesToWildcard, resolveUrlVariables, resolveVariables } from './variables';

describe('variables', () => {
  describe('resolveVariables()', () => {
    const str = 'hello-{var}-world';
    const fallback = 'fallback';
    const regExp = /{([^}]+)}/g;

    it('should return source str if no match', () => {
      const noVarSrc = 'test';
      const result = resolveVariables(noVarSrc, regExp, fallback);
      expect(result).toBe(noVarSrc);
    });

    it('should return fallback in place of variable if no default found', () => {
      const result = resolveVariables(str, regExp, fallback);
      expect(result).toBe('hello-fallback-world');
    });

    it('should return default in place of variable', () => {
      const variables: Record<string, OA3ServerVariable> = {
        var: {
          default: 'bar',
        },
      };
      const result = resolveVariables(str, regExp, fallback, variables);
      expect(result).toBe('hello-bar-world');
    });

    it('should return defaults in place of multiple variables', () => {
      const variables: Record<string, OA3ServerVariable> = {
        var1: {
          default: 'darkness',
        },
        var2: {
          default: 'old',
        },
      };
      const result = resolveVariables('hello-{var1}-my-{var2}-friend', regExp, fallback, variables);
      expect(result).toBe('hello-darkness-my-old-friend');
    });
  });
  describe('resolveUrlVariables()', () => {
    it('should return original url if no variables', () => {
      const url = 'http://api.insomnia.rest';
      expect(resolveUrlVariables(url)).toBe(url);
    });

    it('should replace protocol variable with http if no default provided', () => {
      const url = '{protocol}://api.insomnia.rest';
      expect(resolveUrlVariables(url)).toBe('http://api.insomnia.rest');
    });

    it('should replace protocol variable with default protocol', () => {
      const url = '{protocol}://api.insomnia.rest';
      const variables: Record<string, OA3ServerVariable> = {
        protocol: {
          default: 'https',
        },
      };
      expect(resolveUrlVariables(url, variables)).toBe('https://api.insomnia.rest');
    });

    it('should replace path variable with .* wildcard path if no default provided', () => {
      const url = 'http://api.insomnia.rest/{some}/route';
      expect(resolveUrlVariables(url)).toBe('http://api.insomnia.rest/.*/route');
    });

    it('should replace path variable with default value', () => {
      const url = 'http://api.insomnia.rest/{some}/route';
      const variables = {
        some: {
          default: 'specific',
        },
      };
      expect(resolveUrlVariables(url, variables)).toBe('http://api.insomnia.rest/specific/route');
    });

    it('should handle protocol and path variables with and without defaults', () => {
      const url = '{protocol}://api.insomnia.rest/hello/{var}/my/{another-var}/friend/';
      const variables: Record<string, OA3ServerVariable> = {
        'another-var': {
          default: 'old',
        },
      };
      expect(resolveUrlVariables(url, variables)).toBe(
        'http://api.insomnia.rest/hello/.*/my/old/friend/',
      );
    });

    it('should handle partial routes with variables', () => {
      const partial = '/hello/{var}/my/{another-var}/friend';
      const variables: Record<string, OA3ServerVariable> = {
        'another-var': {
          default: 'old',
        },
      };
      expect(resolveUrlVariables(partial, variables)).toBe('/hello/.*/my/old/friend');
    });
  });
  describe('pathVariablesToWildcard()', () => {
    it('converts variables to .* wildcard', function() {
      expect(pathVariablesToWildcard('/foo/{bar}/{baz}')).toBe('/foo/.*/.*');
    });

    it('does not convert to .* wildcard if no variables present', () => {
      expect(pathVariablesToWildcard('/foo/bar/baz')).toBe('/foo/bar/baz');
    });
  });
});
