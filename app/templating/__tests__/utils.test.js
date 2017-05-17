import * as utils from '../utils';

describe('getKeys()', () => {
  it('flattens complex object', () => {
    const obj = {
      foo: 'bar',
      nested: {a: {b: {}}},
      array: [
        'hello',
        {hi: 'there'},
        true,
        ['x', 'y', 'z']
      ]
    };

    const keys = utils
      .getKeys(obj)
      .sort((a, b) => a.name > b.name ? 1 : -1);

    expect(keys).toEqual([
      {name: 'array[0]', value: obj.array[0]},
      {name: 'array[1].hi', value: obj.array[1].hi},
      {name: 'array[2]', value: obj.array[2]},
      {name: 'array[3][0]', value: obj.array[3][0]},
      {name: 'array[3][1]', value: obj.array[3][1]},
      {name: 'array[3][2]', value: obj.array[3][2]},
      {name: 'foo', value: obj.foo}
    ]);
  });

  it('ignores functions', () => {
    const obj = {
      foo: 'bar',
      toString: function () {
        // Nothing
      }
    };

    const keys = utils.getKeys(obj);
    expect(keys).toEqual([
      {name: 'foo', value: 'bar'}
    ]);
  });
});

describe('tokenizeTag()', () => {
  it('tokenizes complex tag', () => {
    const actual = utils.tokenizeTag(
      `{% name 'foo!@#$%', bar, "baz \\"qux\\""   , 1 + 5 | default("foo") %}`
    );

    const expected = {
      name: 'name',
      args: [
        {type: 'literal', value: 'foo!@#$%'},
        {type: 'variable', value: 'bar'},
        {type: 'literal', value: 'baz "qux"'},
        {type: 'expression', value: '1 + 5 | default("foo")'}
      ]
    };

    expect(actual).toEqual(expected);
  });

  it('handles whitespace', () => {
    const minimal = utils.tokenizeTag(`{%name'foo',bar%}`);
    const generous = utils.tokenizeTag(`{%name  \t'foo'  ,  bar\t\n%}`);

    const expected = {
      name: 'name',
      args: [
        {type: 'literal', value: 'foo'},
        {type: 'variable', value: 'bar'}
      ]
    };

    expect(minimal).toEqual(expected);
    expect(generous).toEqual(expected);
  });

  /**
   * NOTE: This is actually invalid Nunjucks but we handle it anyway
   * because it's better (and easier to implement) than failing.
   */
  it('handles no commas', () => {
    const actual = utils.tokenizeTag(`{% name foo bar baz %}`);

    const expected = {
      name: 'name',
      args: [
        {type: 'expression', value: 'foo bar baz'}
      ]
    };

    expect(actual).toEqual(expected);
  });
});
