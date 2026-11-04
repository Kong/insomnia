import { afterEach, describe, expect, it, vi } from 'vitest';

import { authorizeUserInDefaultBrowser, cancelAuthorizationInDefaultBrowser } from '../authorize-user-in-default-browser';

vi.mock('electron', () => ({ shell: { openExternal: vi.fn(async () => {}) } }));

const callback = 'http://127.0.0.1:53682/callback';

describe('authorizeUserInDefaultBrowser', () => {
  afterEach(() => cancelAuthorizationInDefaultBrowser('test finished'));

  it('resolves with the redirect received on the loopback address', async () => {
    const result = startFlowPromise();
    await waitForListener();
    const response = await fetch(`${callback}?code=abc&state=expected`);

    expect(response.status).toBe(200);
    await expect(result).resolves.toEqual({ redirectUrl: `${callback}?code=abc&state=expected` });
  });

  it('ignores callbacks with the wrong state or path', async () => {
    const result = startFlowPromise();
    await waitForListener();

    expect((await fetch(`${callback}?code=abc&state=forged`)).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:53682/other?code=abc&state=expected`)).status).toBe(404);

    await fetch(`${callback}?code=real&state=expected`);
    await expect(result).resolves.toEqual({ redirectUrl: `${callback}?code=real&state=expected` });
  });

  it('stops listening when the flow is canceled', async () => {
    const result = startFlowPromise();
    await waitForListener();
    cancelAuthorizationInDefaultBrowser('canceled');

    await expect(result).rejects.toThrow('canceled');
    await expect(fetch(callback)).rejects.toThrow();
  });
});

function startFlowPromise() {
  return authorizeUserInDefaultBrowser({
    url: 'https://provider.test/authorize?state=expected',
    openDefaultBrowser: false,
  });
}

const waitForListener = () => new Promise(resolve => setTimeout(resolve, 20));
