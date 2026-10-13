import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Trailing Blank Row In Headers And Params Is Not Persisted Until Typed Into", async ({
  user,
}) => {
  const { httpRequestFlow, workspaceFlow } = user.flowManager;
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

  const headersBefore = await httpRequestPage.getHeaders();
  const paramsBefore = await httpRequestPage.getParams();
  const headerName = faker.string.alphanumeric(8);
  const headerValue = faker.string.alphanumeric(8);
  const paramName = faker.string.alphanumeric(8);
  const paramValue = faker.string.alphanumeric(8);
  await httpRequestPage.setHeaders([{ name: headerName, value: headerValue }]);
  await httpRequestPage.setParams([{ name: paramName, value: paramValue }]);
  const headersAfter = await httpRequestPage.getHeaders();
  const paramsAfter = await httpRequestPage.getParams();

  const isBlank = (pair: { name: string; value: string }) =>
    pair.name === "" && pair.value === "";

  expect(request).toBeDefined();
  expect(headersBefore.some(isBlank)).toBe(false);
  expect(paramsBefore.some(isBlank)).toBe(false);
  expect(headersAfter.some(isBlank)).toBe(false);
  expect(paramsAfter.some(isBlank)).toBe(false);
  expect(headersAfter).toHaveLength(headersBefore.length + 1);
  expect(paramsAfter).toHaveLength(paramsBefore.length + 1);
  expect(headersAfter).toEqual(
    expect.arrayContaining([
      { name: headerName, value: headerValue, disabled: false },
    ]),
  );
  expect(paramsAfter).toEqual(
    expect.arrayContaining([
      { name: paramName, value: paramValue, disabled: false },
    ]),
  );
});
