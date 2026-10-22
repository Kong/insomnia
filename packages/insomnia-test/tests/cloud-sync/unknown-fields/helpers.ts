import { faker } from "@faker-js/faker";

export function buildCloudSyncDocs(
  collectionName: string,
  requestExtra: Record<string, unknown>,
) {
  const suffix = faker.string.alphanumeric({ length: 24, casing: "lower" });
  const workspaceId = `wrk_${suffix}`;
  const requestName = faker.string.alpha(10);
  const docs = [
    {
      _id: workspaceId,
      created: 1_769_407_477_819,
      description: "",
      name: collectionName,
      parentId: null,
      scope: "collection",
      type: "Workspace",
    },
    {
      _id: `env_${suffix}`,
      color: null,
      created: 1_769_407_477_820,
      data: {},
      environmentType: "kv",
      isPrivate: false,
      metaSortKey: 1_769_407_477_820,
      name: "Base Environment",
      parentId: workspaceId,
      type: "Environment",
    },
    {
      _id: `req_${suffix}`,
      authentication: {},
      body: {},
      created: 1_769_407_553_323,
      description: "",
      headers: [],
      isPrivate: false,
      metaSortKey: -1_769_407_553_323,
      method: "GET",
      name: requestName,
      parameters: [],
      parentId: workspaceId,
      pathParameters: [],
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true,
      settingFollowRedirects: "global",
      settingRebuildPath: true,
      settingSendCookies: true,
      settingStoreCookies: true,
      type: "Request",
      url: "",
      ...requestExtra,
    },
  ];
  return { docs, requestName };
}
