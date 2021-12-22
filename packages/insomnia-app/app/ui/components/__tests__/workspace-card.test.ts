import { getVersionDisplayment } from '../workspace-card';

describe('getVersionDisplayment', () => {
  it('returns falsey values as-is', () => {
    expect(getVersionDisplayment(undefined)).toEqual(undefined);
    expect(getVersionDisplayment(null)).toEqual(null);
    expect(getVersionDisplayment('')).toEqual('');
  });

  it('does not add a `v` if the string starts with one', () => {
    expect(getVersionDisplayment('v1')).toEqual('v1');
    expect(getVersionDisplayment('victor')).toEqual('victor');
  });

  it("adds a `v` to all strings that don't start with a v", () => {
    expect(getVersionDisplayment('1')).toEqual('v1');
    expect(getVersionDisplayment('1.0.0')).toEqual('v1.0.0');
    expect(getVersionDisplayment('alpha1')).toEqual('valpha1'); // yes, we know this is non-ideal, see INS-1320.
  });
});
