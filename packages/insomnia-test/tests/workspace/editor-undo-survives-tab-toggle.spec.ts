import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { ScriptTab } from "../../enums/script-tab";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify the Docs editor keeps undo history across a Write/Preview toggle", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const marker = faker.string.alphanumeric(10);
  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  await httpRequestPage.typeDocs(marker);
  await httpRequestPage.setDocsMode("preview");
  await httpRequestPage.setDocsMode("write");
  const docsAfterToggle = await httpRequestPage.getDocs();

  await httpRequestPage.undoDocs();
  const docsAfterUndo = await httpRequestPage.getDocs();

  expect(docsAfterToggle).toContain(marker);
  expect(docsAfterUndo).not.toContain(marker);
});

test("Verify a request script keeps undo history across a Pre-request/After-response toggle", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const marker = faker.string.alphanumeric(10);
  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  await httpRequestPage.typeScripts({ preRequest: marker });
  await httpRequestPage.switchScriptTab(ScriptTab.AfterResponse);
  await httpRequestPage.switchScriptTab(ScriptTab.PreRequest);
  const requestAfterToggle = await httpRequestPage.get();

  await httpRequestPage.undoScript(ScriptTab.PreRequest);
  const requestAfterUndo = await httpRequestPage.get();

  expect(requestAfterToggle.preRequestScript).toContain(marker);
  expect(requestAfterUndo.preRequestScript ?? "").not.toContain(marker);
});
