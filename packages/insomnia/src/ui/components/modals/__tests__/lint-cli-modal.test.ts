import { describe, expect, it } from 'vitest';

import { quotePathArgument } from '../lint-cli-modal';

describe('quotePathArgument', () => {
  it('wraps plain paths in double quotes', () => {
    expect(quotePathArgument('/Users/me/data', false)).toBe('"/Users/me/data"');
  });

  it('escapes characters that POSIX shells expand inside double quotes', () => {
    expect(quotePathArgument('/tmp/a"b$c`d\\e', false)).toBe('"/tmp/a\\"b\\$c\\`d\\\\e"');
  });

  it('leaves Windows paths untouched', () => {
    expect(quotePathArgument('C:\\Users\\me\\data', true)).toBe('"C:\\Users\\me\\data"');
  });
});
