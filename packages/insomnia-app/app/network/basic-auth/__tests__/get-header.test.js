import { globalBeforeEach } from '../../../__jest__/before-each';
import { getBasicAuthHeader } from '../get-header';

describe('getBasicAuthHeader()', () => {
  beforeEach(globalBeforeEach);
  it('succeed with username and password', () => {
    const header = getBasicAuthHeader('user', 'password');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjpwYXNzd29yZA=='
    });
  });

  it('succeed with no username', () => {
    const header = getBasicAuthHeader(null, 'password');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic OnBhc3N3b3Jk'
    });
  });

  it('succeed with username and empty password', () => {
    const header = getBasicAuthHeader('user', '');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjo='
    });
  });

  it('succeed with username and null password', () => {
    const header = getBasicAuthHeader('user', null);
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Basic dXNlcjo='
    });
  });
});
