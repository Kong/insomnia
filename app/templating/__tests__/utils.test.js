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
