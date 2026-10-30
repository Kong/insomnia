import { faker } from "@faker-js/faker";

import type { CloudSyncPage } from "../../../pages/cloud-sync.page";

export function buildCloudSyncDocs(
  collectionName: string,
  requestExtra: Record<string, unknown>,
  extras: { workspace?: Record<string, unknown>; environment?: Record<string, unknown> } = {},
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
      ...extras.workspace,
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
      ...extras.environment,
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

export interface RowWarnings {
  unknownFields: string;
  unsupported: string;
  banner: boolean;
  error: string;
}

export async function commitEachChange(cloudSyncPage: CloudSyncPage, names: string[]) {
  for (const name of names) {
    await cloudSyncPage.openCommitDialog();
    await cloudSyncPage.commit(name, faker.lorem.sentence());
  }
}

export async function readRowWarnings(cloudSyncPage: CloudSyncPage, names: string[]) {
  const warnings: RowWarnings[] = [];
  for (const name of names) {
    await cloudSyncPage.openChangeDiff(name);
    warnings.push({
      unknownFields: await cloudSyncPage.getUnknownFieldsIconTooltip(name),
      unsupported: await cloudSyncPage.getUnsupportedItemIconTooltip(name),
      banner: await cloudSyncPage.isUnknownFieldsDiffWarningVisible(),
      error: await cloudSyncPage.getUnsupportedDocDiffErrorText(),
    });
  }
  return warnings;
}

export const NO_ROW_WARNINGS: RowWarnings = { unknownFields: "", unsupported: "", banner: false, error: "" };
