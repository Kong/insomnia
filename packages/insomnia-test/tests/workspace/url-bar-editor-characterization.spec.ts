import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

test("Verify typing into the URL bar keeps focus and Cmd/Ctrl+Z undoes in place", async ({
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
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  await httpRequestPage.typeUrl("?foo=bar");
  const urlAfterTyping = await httpRequestPage.getUrl();
  const focusedAfterTyping = await httpRequestPage.hasFocus(
    httpRequestPage.urlBarContainer,
  );

  await httpRequestPage.undoUrl();
  const urlAfterUndo = await httpRequestPage.getUrl();
  const focusedAfterUndo = await httpRequestPage.hasFocus(
    httpRequestPage.urlBarContainer,
  );

  expect(urlAfterTyping).toBe(`${request.url}?foo=bar`);
  expect(focusedAfterTyping).toBe(true);
  expect(urlAfterUndo).toBe(request.url);
  expect(focusedAfterUndo).toBe(true);
});

test("Verify importing query params from the URL bar stays undoable", async ({
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
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get?foo=bar`,
  });

  await httpRequestPage.importParamsFromUrl();
  const urlAfterImport = await httpRequestPage.getUrl();

  await httpRequestPage.undoUrl();
  const urlAfterUndo = await httpRequestPage.getUrl();

  expect(urlAfterImport).toBe(`${HTTP_SERVER}/get`);
  expect(urlAfterUndo).toBe(request.url);
});

test("Verify switching environment refreshes the URL bar's rendered variable preview", async ({
  user,
}) => {
  const { workspaceFlow, environmentFlow, httpRequestFlow } = user.flowManager;
  const { httpRequestPage } = user.pageManager;

  const variableName = faker.lorem.word();
  const valueA = faker.string.alphanumeric(10);
  const valueB = faker.string.alphanumeric(10);

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const baseEnvironment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [],
  });
  const environmentA = await environmentFlow.create(baseEnvironment, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: variableName,
        value: valueA,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  const environmentB = await environmentFlow.create(baseEnvironment, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "",
        name: variableName,
        value: valueB,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, environmentA);
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get?value={{ ${variableName} }}`,
  } satisfies HttpRequest);

  await httpRequestFlow.get(request.name);
  const previewWithEnvironmentA = await httpRequestPage.getUrlPreview();

  await environmentFlow.link(collection, environmentB);
  await httpRequestFlow.get(request.name);
  const previewWithEnvironmentB = await httpRequestPage.getUrlPreview();

  expect(previewWithEnvironmentA).toContain(valueA);
  expect(previewWithEnvironmentB).toContain(valueB);
});
