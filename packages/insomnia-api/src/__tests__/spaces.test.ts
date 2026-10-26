import { beforeEach, describe, expect, it, vi } from 'vitest';

import { configureV3Client, getSpaces } from '../spaces';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

// The proxy-aware fetch injected at app startup. In production this is `net.fetch` (main) or
// the browser/Chromium fetch (renderer) — both honor the system proxy. The bug this guards
// against was the v3 SDK bypassing it and using Node's global fetch, which ignores the proxy
// and OS certs, breaking login on proxy-restricted networks.
const fetchApi = vi.fn();

// `configureV3Client` is a one-time singleton, so configure it once for the whole file.
configureV3Client({
  getBaseURL: () => 'https://api.example.test',
  getClientString: () => 'insomnia/test',
  generateRequestId: () => 'req_test',
  fetchApi,
});

describe('getSpaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchApi.mockReset();
  });

  it('routes SDK requests through the configured proxy-aware fetch, not the global fetch', async () => {
    // If the fetchApi wiring regresses, the SDK falls back to global fetch — assert it does not.
    const globalFetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ data: [], meta: { page: { next: null } } }));
    fetchApi.mockResolvedValue(jsonResponse({ data: [], meta: { page: { next: null } } }));

    await getSpaces({ sessionId: 'sess_xyz' });

    expect(fetchApi).toHaveBeenCalledTimes(1);
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });

  it('returns the spaces from the API response', async () => {
    fetchApi.mockResolvedValue(
      jsonResponse({
        data: [
          { id: 'org_1', name: 'Alpha', is_owner: true },
          { id: 'org_2', name: 'Beta', is_owner: false },
        ],
        meta: { page: { next: null } },
      }),
    );

    const spaces = await getSpaces({ sessionId: 'sess_xyz' });

    expect(spaces.map(s => s.id)).toEqual(['org_1', 'org_2']);
  });

  it('paginates using page[after] from meta.page.next', async () => {
    fetchApi
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: 'org_1' }], meta: { page: { next: '/v3/users/me/spaces?page[after]=cursor2' } } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'org_2' }], meta: { page: { next: null } } }));

    const spaces = await getSpaces({ sessionId: 'sess_xyz' });

    expect(fetchApi).toHaveBeenCalledTimes(2);
    expect(spaces.map(s => s.id)).toEqual(['org_1', 'org_2']);
  });
});
