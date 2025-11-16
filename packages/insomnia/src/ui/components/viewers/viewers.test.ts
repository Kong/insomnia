import { expect, it } from 'vitest';

import { unescapeForwardSlash } from '../../../common/misc';

it('unescape forward slash correctly', () => {
  const tests = [
    { input: String.raw`{"path":"some\/dir\/file"}`, expected: '{"path":"some/dir/file"}' },
    { input: String.raw`{"pattern":"\\/abc"}`, expected: String.raw`{"pattern":"\\/abc"}` },
    { input: String.raw`{"weird":"\\\/test"}`, expected: String.raw`{"weird":"\\/test"}` },
  ];
  for (const { input, expected } of tests) {
    const result = unescapeForwardSlash(input);
    expect(result).toBe(expected);
  }
});
