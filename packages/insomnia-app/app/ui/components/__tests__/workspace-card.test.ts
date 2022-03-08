import { getVersionDisplayment } from '../workspace-card';

describe('getVersionDisplayment', () => {
  it('returns null, undefined, and empty string as-is', () => {
    expect(getVersionDisplayment(null)).toEqual(null);
    expect(getVersionDisplayment(undefined)).toEqual(undefined);
    expect(getVersionDisplayment('')).toEqual('');
  });

  it('returns numbers as strings', () => {
    expect(getVersionDisplayment(0)).toEqual('v0'); // important to make sure we handle, since `0` is falsey
    expect(getVersionDisplayment(1)).toEqual('v1');
    expect(getVersionDisplayment(1.1)).toEqual('v1.1');
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
