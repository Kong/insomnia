// @flow
import { isValidKey } from '../environment-editor';

describe('isValidKey', () => {
  it.each(['$', '$a', '$ab'])('%s should be invalid when as key begins with $', key => {
    expect(isValidKey(key)).toBe(false);
  });

  it.each(['.', 'a.', '.a', 'a.b'])('%s  should be invalid when key contains .', key => {
    expect(isValidKey(key)).toBe(false);
  });

  it.each(['$a.b', '$.'])('%s should be invalid when key starts with $ and contains .', key => {
    expect(isValidKey(key)).toBe(false);
  });

  it.each(['a', 'ab', 'a$', 'a$b', 'a-b'])('%s should be valid', key => {
    expect(isValidKey(key)).toBe(true);
  });
});
