// @flow
import { ensureKeyIsValid } from '../environment-editor';
import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../../templating';

describe('ensureKeyIsValid', () => {
  it.each(['$', '$a', '$ab'])('%s should be invalid when as key begins with $', key => {
    expect(ensureKeyIsValid(key)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each(['.', 'a.', '.a', 'a.b'])('%s should be invalid when key contains .', key => {
    expect(ensureKeyIsValid(key)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each(['$a.b', '$.'])('%s should be invalid when key starts with $ and contains .', key => {
    expect(ensureKeyIsValid(key)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  const name = NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME;

  it(`${name} as a key should be invalid`, () => {
    expect(ensureKeyIsValid(name)).toBe(`"${name}" is a reserved key`);
  });

  it.each(['a', 'ab', 'a$', 'a$b', 'a-b', `a${name}b`, `${name}ab`])('%s should be valid', key => {
    expect(ensureKeyIsValid(key)).toBe(null);
  });
});
