import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify URL bar edits and undo history survive switching tabs away and back", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { httpRequestPage, workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const requestA = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const requestB = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  await httpRequestFlow.get(requestA.name);
  await workspacePage.pinTab(requestA.name);

  await httpRequestPage.typeUrl("?foo=bar");
  await user.page.keyboard.press("Tab");
  const urlAfterTyping = await httpRequestPage.getUrl();

  await httpRequestFlow.get(requestB.name);
  await workspacePage.clickTab(requestA.name);
  const urlAfterSwitchingBack = await httpRequestPage.getUrl();
  const focusedAfterSwitchingBack = await httpRequestPage.hasFocus(
    httpRequestPage.urlBarContainer,
  );

  await httpRequestPage.undoUrl();
  const urlAfterUndo = await httpRequestPage.getUrl();

  expect(urlAfterTyping).toBe(`${requestA.url}?foo=bar`);
  expect(urlAfterSwitchingBack).toBe(urlAfterTyping);
  expect(focusedAfterSwitchingBack).toBe(false);
  expect(urlAfterUndo).toBe(requestA.url);
});
