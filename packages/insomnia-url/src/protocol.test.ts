import { setDefaultProtocol } from './protocol';

describe('setDefaultProtocol()', () => {
  it('no-ops on empty url', () => {
    const url = setDefaultProtocol('');
    expect(url).toBe('');
  });

  it('correctly sets protocol for empty', () => {
    const url = setDefaultProtocol('google.com');
    expect(url).toBe('http://google.com');
  });

  it('correctly sets protocol for padded domain', () => {
    const url = setDefaultProtocol('   google.com   ');
    expect(url).toBe('http://google.com');
  });

  it('does not set for valid url', () => {
    const url = setDefaultProtocol('https://google.com');
    expect(url).toBe('https://google.com');
  });

  it('does not set for valid url', () => {
    const url = setDefaultProtocol('http://google.com');
    expect(url).toBe('http://google.com');
  });

  it('does not set for invalid url', () => {
    const url = setDefaultProtocol('httbad://google.com');
    expect(url).toBe('httbad://google.com');
  });
});
