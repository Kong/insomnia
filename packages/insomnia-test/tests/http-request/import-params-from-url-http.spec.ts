import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Import from URL Moves Query String Into Params and Preserves It on Send", async ({
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

  const paramName1 = faker.string.alphanumeric(8);
  const paramValue1 = faker.string.alphanumeric(8);
  const paramName2 = faker.string.alphanumeric(8);
  const paramValue2 = faker.string.alphanumeric(8);
  const baseUrl = `${HTTP_SERVER}/get`;
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${baseUrl}?${paramName1}=${paramValue1}&${paramName2}=${paramValue2}`,
  });
  await httpRequestPage.importParamsFromUrl();
  const updatedUrl = await httpRequestPage.getUrl();
  const updatedParams = await httpRequestPage.getParams();
  const response = await httpRequestFlow.send(request!);

  expect(updatedUrl).toBe(baseUrl);
  expect(updatedParams).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: paramName1, value: paramValue1 }),
      expect.objectContaining({ name: paramName2, value: paramValue2 }),
    ]),
  );
  expect(response.statusCode).toBe(200);
  await expect
    .poll(() => response.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain(
      `Preparing request to ${baseUrl}?${paramName1}=${paramValue1}&${paramName2}=${paramValue2}`,
    );
});
