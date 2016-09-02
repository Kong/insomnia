import * as util from '../util';

describe('getBasicAuthHeader()', () => {
  it('succeed with username and password', () => {
    const header = util.getBasicAuthHeader('user', 'password');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjpwYXNzd29yZA=='
    });
  });

  it('succeed with no username', () => {
    const header = util.getBasicAuthHeader(null, 'password');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic OnBhc3N3b3Jk'
    });
  });

  it('succeed with username and empty password', () => {
    const header = util.getBasicAuthHeader('user', '');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjo='
    });
  });

  it('succeed with username and null password', () => {
    const header = util.getBasicAuthHeader('user', null);
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjo='
    });
  });
});

describe('hasAuthHeader()', () => {
  it('finds valid header', () => {
    const yes = util.hasAuthHeader([
      {name: 'foo', value: 'bar'},
      {name: 'authorization', value: 'foo'}
    ]);

    expect(yes).toEqual(true);
  });

  it('finds valid header case insensitive', () => {
    const yes = util.hasAuthHeader([
      {name: 'foo', value: 'bar'},
      {name: 'AuthOrizAtiOn', value: 'foo'}
    ]);

    expect(yes).toEqual(true);
  })
});
