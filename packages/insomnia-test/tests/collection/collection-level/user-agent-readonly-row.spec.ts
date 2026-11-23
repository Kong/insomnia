import type { FlowManager } from "@package/flows/flow-manager";
import { test } from "@package/misc/fixtures";
import type { HttpRequest } from "@package/models/http-request";
import type { HttpRequestPage } from "@package/pages/http-request.page";
import { expect } from "@playwright/test";

import { createFixture } from "./support";

const DEFAULT_USER_AGENT = /^insomnia\//;

async function getDefaultUserAgentRows(
  flowManager: FlowManager,
  requestPage: HttpRequestPage,
  request: HttpRequest,
) {
  await flowManager.httpRequestFlow.get(request);
  const headers = await requestPage.getHeaders();
  return headers.filter(
    (h) => h.name.toLowerCase() === "user-agent" && DEFAULT_USER_AGENT.test(h.value) && !h.disabled,
  );
}

test("Request Headers tab does not list the default User-Agent once the collection defines one", async ({ user }) => {
  test.fail(true, "INS-4320");
  const { collectionFlow } = user.flowManager;
  const { collection, request } = await createFixture(user.flowManager);

  expect(await getDefaultUserAgentRows(user.flowManager, user.pageManager.httpRequestPage, request)).toHaveLength(1);

  await collectionFlow.setHeaders(collection, [{ name: "User-Agent", value: "custom" }]);
  let response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  expect((response.preview as { headers: Record<string, string> }).headers["user-agent"]).toBe("custom");
  expect(await getDefaultUserAgentRows(user.flowManager, user.pageManager.httpRequestPage, request)).toHaveLength(0);

  await collectionFlow.setHeaders(collection, [{ name: "User-Agent", value: "custom", disabled: true }]);
  response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  expect((response.preview as { headers: Record<string, string> }).headers["user-agent"]).toBeUndefined();
  expect(await getDefaultUserAgentRows(user.flowManager, user.pageManager.httpRequestPage, request)).toHaveLength(0);

  await collectionFlow.setHeaders(collection, []);
  expect(await getDefaultUserAgentRows(user.flowManager, user.pageManager.httpRequestPage, request)).toHaveLength(1);
});

test("Request Headers tab does not list the default User-Agent once a parent folder defines one", async ({ user }) => {
  test.fail(true, "INS-4320");
  const { folderFlow } = user.flowManager;
  const { folders, request } = await createFixture(user.flowManager, { folderDepth: 1 });

  expect(await getDefaultUserAgentRows(user.flowManager, user.pageManager.httpRequestPage, request)).toHaveLength(1);

  const folderPage = await folderFlow.open(folders[0]);
  await folderPage.headers.setHeaders([{ name: "User-Agent", value: "folder-agent" }]);

  const response = await user.flowManager.httpRequestFlow.send(request);
  expect(response.statusBar.code).toBe(200);
  expect((response.preview as { headers: Record<string, string> }).headers["user-agent"]).toBe("folder-agent");
  expect(await getDefaultUserAgentRows(user.flowManager, user.pageManager.httpRequestPage, request)).toHaveLength(0);
});
