jest.unmock('../request');
jest.unmock('../../constants/global');
jest.unmock('jsonschema');

import validate from '../request';

describe('RequestSchema', () => {
  var request;
  
  beforeEach(() => {
    request = {
      id: 'rq_1234567890123',
      created: Date.now(),
      modified: Date.now(),
      url: 'https://google.com',
      name: 'My Request',
      method: 'GET',
      body: '{"foo": "bar"}',
      authentication: {username: 'user', password: 'secret'},
      params: [{name: 'page', value: '3'}],
      headers: [{name: 'Content-Type', value: 'application/json'}]
    };
  });

  it('is valid with all fields', () => {
    expect(validate(request).valid).toBe(true);
  });

  it('is valid with minimal fields', () => {
    request.authentication = {};
    request.headers = [];
    request.params = [];
    expect(validate(request).valid).toBe(true);
  });
  
  it('is not valid with incorrect ID type', () => {
    request.id = 'req_abc';
    expect(validate(request).valid).toBe(false);
  });
  
  it('is not valid with missing fields', () => {
    delete request.created;
    expect(validate(request).valid).toBe(false);
  });

  it('is not valid with extra fields', () => {
    request.extra = 'foo';
    expect(validate(request).valid).toBe(false);
  });
  
  it('is not valid with invalid method', () => {
    request.method = 'NOT_A_REAL_METHOD';
    expect(validate(request).valid).toBe(false);
  });
});
