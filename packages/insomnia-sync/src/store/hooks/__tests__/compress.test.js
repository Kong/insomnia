import hook from '../compress';

describe('read()', () => {
  it('writes compressed data', async () => {
    const compressed = await hook.write('', 'hello');
    expect(compressed.toString('base64')).toBe('H4sIAAAAAAAAE8tIzcnJBwCGphA2BQAAAA==');
  });

  it('writes raw data for extensions', async () => {
    const compressed = await hook.write('.json', 'hello');
    expect(compressed.toString('base64')).toBe('hello');
  });

  it('reads compressed data', async () => {
    const data = Buffer.from('H4sIAAAAAAAAE8tIzcnJBwCGphA2BQAAAA==', 'base64');
    const compressed = await hook.read('', data);
    expect(compressed.toString('utf8')).toBe('hello');
  });

  it('reads compressed data', async () => {
    const data = Buffer.from('hello', 'utf8');
    const compressed = await hook.read('.json', data);
    expect(compressed.toString('utf8')).toBe('hello');
  });
});
