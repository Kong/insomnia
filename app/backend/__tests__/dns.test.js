import * as dnsUtils from '../dns';

describe('swapHost()', () => {
  it('succeed with localhost', async () => {
    const ip = await dnsUtils.swapHost('http://localhost');
    expect(ip).toEqual('http://127.0.0.1/');
  });

  it('no-op on invalid', async () => {
    const ip = await dnsUtils.swapHost('http://poooooooop');
    expect(ip).toEqual('http://poooooooop');
  });
});
