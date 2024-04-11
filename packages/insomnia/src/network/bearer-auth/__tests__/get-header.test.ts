import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { getBearerAuthHeader } from '../get-header';

describe('getBearerAuthHeader()', () => {
  beforeEach(globalBeforeEach);

  it('succeed with token and prefix', () => {
    const header = getBearerAuthHeader('token', 'prefix');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'prefix token',
    });
  });

  it('succeed with no prefix', () => {
    const header = getBearerAuthHeader('token');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'Bearer token',
    });
  });

  it('succeed with token with leading and trailing spaces', () => {
    const header = getBearerAuthHeader('  token ', 'prefix');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'prefix token',
    });
  });

  it('succeed with prefix with leading and trailing spaces', () => {
    const header = getBearerAuthHeader('token', ' prefix  ');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'prefix token',
    });
  });

  it('succeed with token and prefix with leading and trailing spaces', () => {
    const header = getBearerAuthHeader(' token  ', '  prefix   ');
    expect(header).toEqual({
      name: 'Authorization',
      value: 'prefix token',
    });
  });
});
