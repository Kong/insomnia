import { expect, it } from 'vitest';

import { unescapeForwardSlash } from '../../../common/misc';

it('unescape forward slash correctly', () => {
  const tests = [
    { input: '{"path":"some\\/dir\\/file"}', expected: '{"path":"some/dir/file"}' },
    { input: '{"pattern":"\\\\/abc"}', expected: '{"pattern":"\\\\/abc"}' },
    { input: '{"weird":"\\\\\\/test"}', expected: '{"weird":"\\\\/test"}' },
  ];
  tests.forEach(({ input, expected }) => {
    const result = unescapeForwardSlash(input);
    expect(result).toBe(expected);
  });
});
