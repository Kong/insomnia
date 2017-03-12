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

    const keys = utils.getKeys(obj);
    expect(keys).toEqual({
      'array[0]': obj.array[0],
      'array[1].hi': obj.array[1].hi,
      'array[2]': obj.array[2],
      'array[3][0]': obj.array[3][0],
      'array[3][1]': obj.array[3][1],
      'array[3][2]': obj.array[3][2],
      'foo': obj.foo
    });
  });

  it('ignores functions', () => {
    const obj = {
      foo: 'bar',
      toString: function () {
        // Nothing
      }
    };

    const keys = utils.getKeys(obj);
    expect(keys).toEqual({
      foo: 'bar'
    });
  });
});
