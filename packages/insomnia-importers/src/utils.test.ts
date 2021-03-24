import { setDefaults, unthrowableParseJson } from './utils';

describe('setDefaults()', () => {
  it('should leave non-objects alone', () => {
    expect(setDefaults(null)).toBe(null);
  });
  it('should leave unrecognized types alone', () => {
    const obj = {
      _type: 'weird',
    };
    // @ts-expect-error -- this is an intentionally unrecognized `_type`
    expect(setDefaults(obj)).toBe(obj);
  });
  it('should set correct request defaults', () => {
    expect(
      setDefaults({
        _type: 'request',
      }),
    ).toEqual({
      _type: 'request',
      parentId: '__WORKSPACE_ID__',
      name: 'Imported',
      url: '',
      body: '',
      method: 'GET',
      parameters: [],
      headers: [],
      authentication: {},
    });
  });
  it('should set correct request_group defaults', () => {
    expect(
      setDefaults({
        _type: 'request_group',
      }),
    ).toEqual({
      _type: 'request_group',
      parentId: '__WORKSPACE_ID__',
      name: 'Imported',
      environment: {},
    });
  });
  it('should set correct environment defaults', () => {
    expect(
      setDefaults({
        _type: 'environment',
      }),
    ).toEqual({
      _type: 'environment',
      parentId: '__BASE_ENVIRONMENT_ID__',
      name: 'Imported Environment',
      data: {},
    });
  });
  describe('unthrowableParseJson', () => {
    it('should parse happy json', () => {
      const json = '{"foo": "bar"}';
      const obj = unthrowableParseJson(json);
      expect(obj).toEqual({
        foo: 'bar',
      });
    });
    it('should quietly fail on bad json', () => {
      expect(() => {
        const json = '{"foo": "bar';
        const obj = unthrowableParseJson(json);
        expect(obj).toBeNull();
      }).not.toThrow();
    });
  });
});
