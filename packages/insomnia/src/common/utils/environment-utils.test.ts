import { EnvironmentKvPairDataType, models } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME } from '~/templating';

import {
  checkNestedKeys,
  ensureKeyIsValid,
  getDataFromKVPair,
  getKVPairFromData,
  maskVaultEnvironmentData,
} from './environment-utils';

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

  it.each([
    '_',
    'a',
    'ab',
    'a$',
    'a$b',
    'a-b',
    `a${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}b`,
    `${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}ab`,
  ])('"%s" should be valid as a nested key', key => {
    expect(ensureKeyIsValid(key, false)).toBe(null);
  });

  it.each([
    'a',
    'ab',
    'a$',
    'a$b',
    'a-b',
    `a${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}b`,
    `${NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME}ab`,
  ])('"%s" should be valid as a root value', key => {
    expect(ensureKeyIsValid(key, true)).toBe(null);
  });
});

describe('checkNestedKeys()', () => {
  it('should check root property and error', () => {
    const obj = {
      'base-url': 'https://api.insomnia.rest',
      '$nes.ted': {
        'path-with-hyphens': '/path-with-hyphen',
      },
      'ar-ray': [
        '/first',
        {
          second: 'second',
        },
        {
          third: 'third',
        },
      ],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe("\"$nes.ted\" cannot begin with '$' or contain a '.'");
  });

  it('should check nested property and error', () => {
    const obj = {
      'base-url': 'https://api.insomnia.rest',
      'nested': {
        '$path-wi.th-hyphens': '/path-with-hyphen',
      },
      'ar-ray': [
        '/first',
        {
          second: 'second',
        },
        {
          third: 'third',
        },
      ],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe("\"$path-wi.th-hyphens\" cannot begin with '$' or contain a '.'");
  });

  it('should check for complex objects inside array', () => {
    const obj = {
      'base-url': 'https://api.insomnia.rest',
      'nested': {
        'path-with-hyphens': '/path-with-hyphen',
      },
      'ar-ray': [
        '/first',
        {
          second: 'second',
        },
        {
          'thi.rd': 'third',
        },
      ],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe("\"thi.rd\" cannot begin with '$' or contain a '.'");
  });

  it('should check nested properties and pass', () => {
    const obj = {
      'base-url': 'https://api.insomnia.rest',
      'nested': {
        'path-with-hyphens': '/path-with-hyphen',
      },
      'ar-ray': [
        '/first',
        {
          second: 'second',
        },
        {
          third: 'third',
        },
      ],
    };

    const err = checkNestedKeys(obj);

    expect(err).toBe(null);
  });
});

describe('getKVPairFromData()', () => {
  it('converts string values to STRING type', () => {
    const data = { foo: 'bar', num: 42 };
    const result = getKVPairFromData(data, null);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: 'foo',
      value: 'bar',
      type: EnvironmentKvPairDataType.STRING,
      enabled: true,
    });
    expect(result[1]).toMatchObject({
      name: 'num',
      value: '42',
      type: EnvironmentKvPairDataType.STRING,
      enabled: true,
    });
  });

  it('converts object values to JSON type', () => {
    const data = { kvPair: { foo: 'bar' } };
    const result = getKVPairFromData(data, null);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'kvPair',
      value: JSON.stringify({ foo: 'bar' }),
      type: EnvironmentKvPairDataType.JSON,
      enabled: true,
    });
  });

  it('converts vault path entries to SECRET type with individual keys', () => {
    const data = { [models.environment.vaultEnvironmentPath]: { secret1: 'val1', secret2: 'val2' } };
    const result = getKVPairFromData(data, null);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: 'secret1',
      value: 'val1',
      type: EnvironmentKvPairDataType.SECRET,
      enabled: true,
    });
    expect(result[1]).toMatchObject({
      name: 'secret2',
      value: 'val2',
      type: EnvironmentKvPairDataType.SECRET,
      enabled: true,
    });
  });

  it('handles mixed data with strings, objects, and secrets', () => {
    const data = { str: 'hello', obj: { x: 1 }, [models.environment.vaultEnvironmentPath]: { pw: 'secret' } };
    const result = getKVPairFromData(data, null);
    expect(result).toHaveLength(3);
    const types = result.map(r => r.type);
    expect(types).toContain(EnvironmentKvPairDataType.STRING);
    expect(types).toContain(EnvironmentKvPairDataType.JSON);
    expect(types).toContain(EnvironmentKvPairDataType.SECRET);
  });
});

describe('getDataFromKVPair()', () => {
  it('converts STRING pairs back to string values', () => {
    const kvPair = [{ id: '1', name: 'foo', value: 'bar', type: EnvironmentKvPairDataType.STRING, enabled: true }];
    const { data } = getDataFromKVPair(kvPair);
    expect(data).toEqual({ foo: 'bar' });
  });

  it('converts JSON pairs back to parsed objects', () => {
    const kvPair = [{ id: '1', name: 'obj', value: '{"a":1}', type: EnvironmentKvPairDataType.JSON, enabled: true }];
    const { data } = getDataFromKVPair(kvPair);
    expect(data).toEqual({ obj: { a: 1 } });
  });

  it('groups SECRET pairs under vault path', () => {
    const kvPair = [
      { id: '1', name: 'pw', value: 'secret', type: EnvironmentKvPairDataType.SECRET, enabled: true },
      { id: '2', name: 'token', value: 'tok', type: EnvironmentKvPairDataType.SECRET, enabled: true },
    ];
    const { data } = getDataFromKVPair(kvPair);
    expect(data[models.environment.vaultEnvironmentPath]).toEqual({ pw: 'secret', token: 'tok' });
  });

  it('skips disabled pairs', () => {
    const kvPair = [
      { id: '1', name: 'active', value: 'yes', type: EnvironmentKvPairDataType.STRING, enabled: true },
      { id: '2', name: 'inactive', value: 'no', type: EnvironmentKvPairDataType.STRING, enabled: false },
    ];
    const { data } = getDataFromKVPair(kvPair);
    expect(data).toEqual({ active: 'yes' });
    expect(data).not.toHaveProperty('inactive');
  });

  it('returns dataPropertyOrder as null', () => {
    const { dataPropertyOrder } = getDataFromKVPair([]);
    expect(dataPropertyOrder).toBeNull();
  });
});

describe('maskVaultEnvironmentData()', () => {
  const makeEnv = (overrides: object) =>
    ({
      _id: 'env_1',
      type: 'Environment',
      parentId: 'ws_1',
      created: 0,
      modified: 0,
      name: 'Test',
      color: null,
      metaSortKey: 0,
      isPrivate: false,
      dataPropertyOrder: null,
      data: {},
      ...overrides,
    }) as any;

  it('does not mask data for non-private environments', () => {
    const env = makeEnv({
      isPrivate: false,
      data: { [models.environment.vaultEnvironmentPath]: { pw: 'secret' } },
      kvPairData: [{ id: '1', name: 'pw', value: 'secret', type: EnvironmentKvPairDataType.SECRET, enabled: true }],
    });
    const result = maskVaultEnvironmentData(env);
    expect(result.data[models.environment.vaultEnvironmentPath].pw).toBe('secret');
    expect(result.kvPairData![0].value).toBe('secret');
  });

  it('masks vault data and kvPairData for private environments with secrets', () => {
    const env = makeEnv({
      isPrivate: true,
      data: { [models.environment.vaultEnvironmentPath]: { pw: 'secret', token: 'tok' } },
      kvPairData: [
        { id: '1', name: 'pw', value: 'secret', type: EnvironmentKvPairDataType.SECRET, enabled: true },
        { id: '2', name: 'token', value: 'tok', type: EnvironmentKvPairDataType.SECRET, enabled: true },
      ],
    });
    const result = maskVaultEnvironmentData(env);
    expect(result.data[models.environment.vaultEnvironmentPath].pw).toBe(models.environment.vaultEnvironmentMaskValue);
    expect(result.data[models.environment.vaultEnvironmentPath].token).toBe(
      models.environment.vaultEnvironmentMaskValue,
    );
    expect(result.kvPairData![0].value).toBe(models.environment.vaultEnvironmentMaskValue);
    expect(result.kvPairData![1].value).toBe(models.environment.vaultEnvironmentMaskValue);
  });

  it('does not mask non-secret kvPairData entries in private environments', () => {
    const env = makeEnv({
      isPrivate: true,
      data: { [models.environment.vaultEnvironmentPath]: { pw: 'secret' }, str: 'visible' },
      kvPairData: [
        { id: '1', name: 'pw', value: 'secret', type: EnvironmentKvPairDataType.SECRET, enabled: true },
        { id: '2', name: 'str', value: 'visible', type: EnvironmentKvPairDataType.STRING, enabled: true },
      ],
    });
    const result = maskVaultEnvironmentData(env);
    expect(result.kvPairData![1].value).toBe('visible');
  });
});
