// @flow
import { ensureKeyIsValid } from '../environment-editor';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../../templating';
const name = NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME;

describe('ensureNestedKeyIsValid', () => {
  it.each(['$', '$a', '$ab'])('%s should be invalid when key begins with $', key => {
    expect(ensureKeyIsValid(key)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each(['.', 'a.', '.a', 'a.b'])('%s should be invalid when key contains .', key => {
    expect(ensureKeyIsValid(key)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each(['$a.b', '$.'])('%s should be invalid when key starts with $ and contains .', key => {
    expect(ensureKeyIsValid(key)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each(['a', 'ab', 'a$', 'a$b', 'a-b', `a${name}b`, `${name}ab`])('%s should be valid', key => {
    expect(ensureKeyIsValid(key)).toBe(null);
  });
});

describe('ensureRootKeyIsValid', () => {
  it.each(['_'])('%s should be invalid when key is _', key => {
    expect(ensureKeyIsValid(key, true)).toBe(`"${key}" is a reserved key`);
  });

  it.each(['a', 'ab', 'a$', 'a$b', 'a-b', `a b`])('%s should be valid', key => {
    expect(ensureKeyIsValid(key, true)).toBe(null);
  });
});
