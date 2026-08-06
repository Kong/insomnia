import type { AnyRequest, Request, RequestRepository } from 'insomnia-domain';

export function createFakeRequestRepository(seed: AnyRequest[] = []): RequestRepository {
  const store = new Map(seed.map(r => [r._id, r]));
  return {
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findByParentId(parentId) {
      return [...store.values()].filter(r => r.parentId === parentId);
    },
    async save(request) {
      store.set(request._id, request);
    },
    async delete(id) {
      store.delete(id);
    },
  };
}

export const buildRequest = (overrides: Partial<Request> = {}): Request => ({
  _id: 'req_1',
  type: 'Request',
  parentId: 'wrk_1',
  created: 0,
  modified: 0,
  isPrivate: false,
  name: 'Original',
  description: '',
  url: '',
  method: 'GET',
  body: {},
  parameters: [],
  headers: [],
  authentication: {},
  metaSortKey: 0,
  settingStoreCookies: true,
  settingSendCookies: true,
  settingDisableRenderRequestBody: false,
  settingEncodeUrl: true,
  settingRebuildPath: true,
  settingFollowRedirects: 'global',
  ...overrides,
});
