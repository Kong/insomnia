import { globalBeforeEach } from '../../__jest__/before-each';
import * as utils from '../utils';

describe('getKeys()', () => {
  beforeEach(globalBeforeEach);

  it('flattens complex object', () => {
    const obj = {
      foo: 'bar',
      nested: {
        a: {
          b: {},
        },
      },
      null: null,
      undefined: undefined,
      false: false,
      array: [
        'hello',
        {
          hi: 'there',
        },
        true,
        ['x', 'y', 'z'],
      ],
    };
    const keys = utils.getKeys(obj).sort((a, b) => (a.name > b.name ? 1 : -1));
    expect(keys).toEqual([
      {
        name: 'array[0]',
        value: obj.array[0],
      },
      {
        name: 'array[1].hi',
        value: obj.array[1].hi,
      },
      {
        name: 'array[2]',
        value: obj.array[2],
      },
      {
        name: 'array[3][0]',
        value: obj.array[3][0],
      },
      {
        name: 'array[3][1]',
        value: obj.array[3][1],
      },
      {
        name: 'array[3][2]',
        value: obj.array[3][2],
      },
      {
        name: 'false',
        value: obj.false,
      },
      {
        name: 'foo',
        value: obj.foo,
      },
      {
        name: 'null',
        value: obj.null,
      },
      {
        name: 'undefined',
        value: obj.undefined,
      },
    ]);
  });

  it('ignores functions', () => {
    const obj = {
      foo: 'bar',
      toString: function() {
        // Nothing
      },
    };
    const keys = utils.getKeys(obj);
    expect(keys).toEqual([
      {
        name: 'foo',
        value: 'bar',
      },
    ]);
  });
});

describe('tokenizeTag()', () => {
  beforeEach(globalBeforeEach);

  it('tokenizes complex tag', () => {
    const actual = utils.tokenizeTag('{% name bar, "baz \\"qux\\""   , 1 + 5 | default("foo") %}');
    const expected = {
      name: 'name',
      args: [
        {
          type: 'variable',
          value: 'bar',
        },
        {
          type: 'string',
          value: 'baz "qux"',
          quotedBy: '"',
        },
        {
          type: 'expression',
          value: '1 + 5 | default("foo")',
        },
      ],
    };
    expect(actual).toEqual(expected);
  });

  it('handles whitespace', () => {
    const minimal = utils.tokenizeTag("{%name'foo',bar%}");
    const generous = utils.tokenizeTag("{%name  \t'foo'  ,  bar\t\n%}");
    const expected = {
      name: 'name',
      args: [
        {
          type: 'string',
          value: 'foo',
          quotedBy: "'",
        },
        {
          type: 'variable',
          value: 'bar',
        },
      ],
    };
    expect(minimal).toEqual(expected);
    expect(generous).toEqual(expected);
  });

  it('handles type string', () => {
    const actual = utils.tokenizeTag("{% name 'foo' %}");
    const expected = {
      name: 'name',
      args: [
        {
          type: 'string',
          value: 'foo',
          quotedBy: "'",
        },
      ],
    };
    expect(actual).toEqual(expected);
  });

  it('handles type number', () => {
    const actual = utils.tokenizeTag('{% name 9.324, 8, 7 %}');
    const expected = {
      name: 'name',
      args: [
        {
          type: 'number',
          value: '9.324',
        },
        {
          type: 'number',
          value: '8',
        },
        {
          type: 'number',
          value: '7',
        },
      ],
    };
    expect(actual).toEqual(expected);
  });

  it('handles type boolean', () => {
    const actual = utils.tokenizeTag('{% name true, false %}');
    const expected = {
      name: 'name',
      args: [
        {
          type: 'boolean',
          value: true,
        },
        {
          type: 'boolean',
          value: false,
        },
      ],
    };
    expect(actual).toEqual(expected);
  });

  it('handles type expression', () => {
    const actual = utils.tokenizeTag("{% name 5 * 10 + 'hello' | default(2 - 3) %}");
    const expected = {
      name: 'name',
      args: [
        {
          type: 'expression',
          value: "5 * 10 + 'hello' | default(2 - 3)",
        },
      ],
    };
    expect(actual).toEqual(expected);
  });

  /**
   * NOTE: This is actually invalid Nunjucks but we handle it anyway
   * because it's better (and easier to implement) than failing.
   */
  it('handles no commas', () => {
    const actual = utils.tokenizeTag('{% name foo bar baz %}');
    const expected = {
      name: 'name',
      args: [
        {
          type: 'expression',
          value: 'foo bar baz',
        },
      ],
    };
    expect(actual).toEqual(expected);
  });
});

describe('unTokenizeTag()', () => {
  beforeEach(globalBeforeEach);

  it('handles the default case', () => {
    const tagStr = '{% name bar, "baz \\"qux\\""   , 1 + 5, \'hi\' %}';
    const tagData = utils.tokenizeTag(tagStr);
    const result = utils.unTokenizeTag(tagData);
    expect(result).toEqual('{% name bar, "baz \\"qux\\"", 1 + 5, \'hi\' %}');
  });

  it('quotes for all necessary types', () => {
    const tagData = {
      name: 'name',
      args: [
        {
          type: 'boolean',
          value: 'true',
        },
        {
          type: 'enum',
          value: 'foo',
        },
        {
          type: 'expression',
          value: 'foo.length',
        },
        {
          type: 'file',
          value: 'foo/bar/baz',
        },
        {
          type: 'model',
          value: 'id_123',
        },
        {
          type: 'number',
          value: '10',
        },
        {
          type: 'string',
          value: 'foo',
        },
        {
          type: 'variable',
          value: 'var',
        },
      ],
    };
    const result = utils.unTokenizeTag(tagData);
    expect(result).toEqual(
      "{% name true, 'foo', foo.length, 'foo/bar/baz', 'id_123', 10, 'foo', var %}",
    );
  });

  it('fixes missing quotedBy attribute', () => {
    const tagData = {
      name: 'name',
      args: [
        {
          type: 'file',
          value: 'foo/bar/baz',
        },
        {
          type: 'model',
          value: 'foo',
        },
      ],
    };
    const result = utils.unTokenizeTag(tagData);
    expect(result).toEqual("{% name 'foo/bar/baz', 'foo' %}");
  });
});

describe('encodeEncoding()', () => {
  beforeEach(globalBeforeEach);

  it('encodes things', () => {
    expect(utils.encodeEncoding('hello', 'base64')).toBe('b64::aGVsbG8=::46b');
    expect(utils.encodeEncoding(null, 'base64')).toBe(null);
    expect(utils.encodeEncoding('hello')).toBe('hello');
    expect(utils.encodeEncoding('', 'base64')).toBe('');
  });
});

describe('decodeEncoding()', () => {
  beforeEach(globalBeforeEach);

  it('encodes things', () => {
    expect(utils.decodeEncoding('b64::aGVsbG8=::46b')).toBe('hello');
    expect(utils.decodeEncoding('aGVsbG8=')).toBe('aGVsbG8=');
    expect(utils.decodeEncoding('hello')).toBe('hello');
    expect(utils.decodeEncoding(null)).toBe(null);
    expect(utils.decodeEncoding('')).toBe('');
  });
});
