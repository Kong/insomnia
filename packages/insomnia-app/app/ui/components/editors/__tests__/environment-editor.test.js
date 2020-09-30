// @flow
import { isValidNeDBKey } from '../environment-editor';

describe('isValidKey', () => {
  it.each(['$', '$a', '$ab'])('%s should be invalid when as key begins with $', key => {
    expect(isValidNeDBKey(key)).toBe(false);
  });

  it.each(['.', 'a.', '.a', 'a.b'])('%s should be invalid when key contains .', key => {
    expect(isValidNeDBKey(key)).toBe(false);
  });

  it.each(['$a.b', '$.'])('%s should be invalid when key starts with $ and contains .', key => {
    expect(isValidNeDBKey(key)).toBe(false);
  });

  it.each(['a', 'ab', 'a$', 'a$b', 'a-b'])('%s should be valid', key => {
    expect(isValidNeDBKey(key)).toBe(true);
  });
});
