// @flow

import { escapeJsStr, indent } from '../util';

describe('util', () => {
  describe('indent()', () => {
    it('skips indent on <= 0', () => {
      expect(indent(0, 'hello')).toBe('hello');
      expect(indent(-1, 'hello')).toBe('hello');
    });

    it('indents single lines', () => {
      expect(indent(1, 'hello')).toBe('  hello');
      expect(indent(3, 'hello')).toBe('      hello');
    });

    it('indents multi-line blocks', () => {
      const text = `function greet() {\n  console.log('Hello World!');\n}`;
      expect(indent(1, text)).toBe(`  function greet() {\n    console.log('Hello World!');\n  }`);
    });
  });

  describe('escapeJsStr()', () => {
    it('does not escape something without quotes', () => {
      expect(escapeJsStr('Hello World')).toBe('Hello World');
    });
    it('escapes something with quotes', () => {
      expect(escapeJsStr(`"Hello" 'World'`)).toBe(`"Hello" \\'World\\'`);
    });
  });
});
