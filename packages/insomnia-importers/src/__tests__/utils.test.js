'use strict';

const utils = require('../../src/utils');

describe('setDefaults()', () => {
  it('should leave non-objects alone', () => {
    expect(utils.setDefaults(null)).toBe(null);
  });

  it('should leave unrecognized types alone', () => {
    const obj = { _type: 'weird' };
    expect(utils.setDefaults(obj)).toBe(obj);
  });

  it('should set correct request defaults', () => {
    expect(utils.setDefaults({ _type: 'request' })).toEqual({
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
    expect(utils.setDefaults({ _type: 'request_group' })).toEqual({
      _type: 'request_group',
      parentId: '__WORKSPACE_ID__',
      name: 'Imported',
      environment: {},
    });
  });

  it('should set correct environment defaults', () => {
    expect(utils.setDefaults({ _type: 'environment' })).toEqual({
      _type: 'environment',
      parentId: '__BASE_ENVIRONMENT_ID__',
      name: 'Imported Environment',
      data: {},
    });
  });

  describe('unthrowableParseJson', () => {
    it('should parse happy json', () => {
      const json = '{"foo": "bar"}';
      const obj = utils.unthrowableParseJson(json);

      expect(obj).toEqual({ foo: 'bar' });
    });

    it('should quietly fail on bad json', () => {
      expect(() => {
        const json = '{"foo": "bar';
        const obj = utils.unthrowableParseJson(json);

        expect(obj).toBeNull();
      }).not.toThrow();
    });
  });
});
