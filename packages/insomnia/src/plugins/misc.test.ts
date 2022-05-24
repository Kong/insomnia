import { describe, expect, it } from '@jest/globals';

import { validateThemeName } from './misc';

describe('validateThemeName', () => {
  it('will return valid names as-is', () => {
    const name = 'default-dark';
    const validName = validateThemeName(name);
    expect(name).toEqual(validName);
  });

  it('will lowercase', () => {
    const name = 'Default-dark';
    const validName = validateThemeName(name);
    expect(name).not.toEqual(validName);
    expect(validName).toEqual('default-dark');
  });

  it('will replace spaces', () => {
    const name = 'default dark';
    const validName = validateThemeName(name);
    expect(name).not.toEqual(validName);
    expect(validName).toEqual('default-dark');
  });
});
