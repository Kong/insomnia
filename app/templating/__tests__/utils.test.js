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

    const sortedKeys = utils.getKeys(obj).sort();
    expect(sortedKeys).toEqual([
      'array',
      'array[0]',
      'array[1]',
      'array[1].hi',
      'array[2]',
      'array[3]',
      'array[3][0]',
      'array[3][1]',
      'array[3][2]',
      'foo',
      'nested',
      'nested.a',
      'nested.a.b'
    ]);
  });
});
