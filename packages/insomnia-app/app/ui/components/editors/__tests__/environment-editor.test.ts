import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '../../../../templating';
import { checkNestedKeys, ensureKeyIsValid } from '../environment-editor';

const name = NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME;

describe('ensureKeyIsValid()', () => {
  it.each(['$', '$a', '$ab'])('"%s" should be invalid when key begins with $', key => {
    expect(ensureKeyIsValid(key, false)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each(['.', 'a.', '.a', 'a.b'])('"%s" should be invalid when key contains .', key => {
    expect(ensureKeyIsValid(key, false)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each(['$a.b', '$.'])('"%s" should be invalid when key starts with $ and contains .', key => {
    expect(ensureKeyIsValid(key, false)).toBe(`"${key}" cannot begin with '$' or contain a '.'`);
  });

  it.each(['_'])('"%s" should be invalid when key is _', key => {
    expect(ensureKeyIsValid(key, true)).toBe(`"${key}" is a reserved key`);
  });

  it.each(['a', 'ab', 'a$', 'a$b', 'a-b', `a${name}b`, `${name}ab`, '_'])('"%s" should be valid', key => {
    expect(ensureKeyIsValid(key, false)).toBe(undefined);
  });
});

describe('checkNestedKeys()', () => {
  it('should check nested property and error', () => {
    const obj = {
      foo: {
        bar: {
          'b.a$z': 'baz',
        },
      },
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe('"b.a$z" cannot begin with \'$\' or contain a \'.\'');
  });

  it('should check for complex objects inside array', () => {
    const obj = {
      arr: [{
        bar: {
          'b.a$z': 'baz',
        },
      }],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe('"b.a$z" cannot begin with \'$\' or contain a \'.\'');
  });

  it('should check nested properties and pass', () => {
    const obj = {
      foo: {
        arr: [1, { abc: 123 }, 2],
        val: 'true',
        obj: {
          'b-a-z': 'baz',
        },
      },
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe(null);
  });
});
