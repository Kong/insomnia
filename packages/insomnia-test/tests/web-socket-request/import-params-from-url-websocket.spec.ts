import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT, test, WS_SERVER } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Import from URL Moves Query String Into Params and Preserves It on Connect", async ({
  user,
}) => {
  const { webSocketRequestFlow, workspaceFlow } = user.flowManager;
  const { webSocketRequestPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const paramName1 = faker.string.alphanumeric(8);
  const paramValue1 = faker.string.alphanumeric(8);
  const paramName2 = faker.string.alphanumeric(8);
  const paramValue2 = faker.string.alphanumeric(8);
  const baseUrl = WS_SERVER;
  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: `${baseUrl}?${paramName1}=${paramValue1}&${paramName2}=${paramValue2}`,
  });
  await webSocketRequestPage.importParamsFromUrl();
  const updatedUrl = await webSocketRequestPage.getUrl();
  const updatedParams = await webSocketRequestPage.getParams();
  await webSocketRequestFlow.send(request);
  const responseView = await webSocketRequestFlow.disconnect(request);

  expect(updatedUrl).toBe(baseUrl);
  expect(updatedParams).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: paramName1, value: paramValue1 }),
      expect.objectContaining({ name: paramName2, value: paramValue2 }),
    ]),
  );
  await expect
    .poll(() => responseView.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("101 Switching Protocols");
  await expect
    .poll(() => responseView.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain(
      `Preparing request to ${baseUrl}?${paramName1}=${paramValue1}&${paramName2}=${paramValue2}`,
    );
});
