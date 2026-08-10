import { describe, expect, it } from 'vitest';

import { Variable, VariableList } from '../variables';

describe('test Variables object', () => {
  it('test basic operations', () => {
    const variable = new Variable({
      id: 'id',
      key: 'key',
      name: 'name',
      value: 'value',
      type: 'type',
      disabled: false,
    });

    expect(variable.get()).toBe('value');
    variable.set('value2');
    expect(variable.get()).toBe('value2');
  });

  it('VariableList operations', () => {
    const varList = new VariableList(undefined, [
      new Variable({ key: 'h1', value: 'v1' }),
      new Variable({ key: 'h2', value: 'v2' }),
    ]);

    const upserted = new Variable({ key: 'h1', value: 'v1upserted' });
    varList.upsert(upserted);
    expect(varList.one('h1')).toEqual(upserted);
  });

  it('toObject returns {} when there are no variables', () => {
    expect(new VariableList(undefined, []).toObject()).toEqual({});
  });

  it('toObject returns a key-value map when there are variables', () => {
    const varList = new VariableList(undefined, [
      new Variable({ key: 'h1', value: 'v1' }),
      new Variable({ key: 'h2', value: 'v2' }),
    ]);

    expect(varList.toObject()).toEqual({ h1: 'v1', h2: 'v2' });
  });

  it('toObject includes disabled variables by default but excludes them when excludeDisabled is true', () => {
    const varList = new VariableList(undefined, [
      new Variable({ key: 'h1', value: 'v1' }),
      new Variable({ key: 'h2', value: 'v2', disabled: true }),
    ]);

    expect(varList.toObject()).toEqual({ h1: 'v1', h2: 'v2' });
    expect(varList.toObject(true)).toEqual({ h1: 'v1' });
  });

  it('toObject collapses duplicate keys to the last value by default, but collects them into an array when multiValue is true', () => {
    const varList = new VariableList(undefined, [
      new Variable({ key: 'h1', value: 'v1' }),
      new Variable({ key: 'h1', value: 'v1b' }),
      new Variable({ key: 'h2', value: 'v2' }),
    ]);

    expect(varList.toObject()).toEqual({ h1: 'v1b', h2: 'v2' });
    expect(varList.toObject(false, false, true)).toEqual({ h1: ['v1', 'v1b'], h2: 'v2' });
  });
});
