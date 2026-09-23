import * as path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER_CUSTOM_CA_HTTPS,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER_CUSTOM_CA_HTTPS}/post`;

test("Verify Custom CA Root Certificate Establishes Trust For HTTPS Request", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, certificatesFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const requestBeforeCa = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
  });
  const responseBeforeCa = await httpRequestFlow.send(requestBeforeCa);
  expect(responseBeforeCa.statusCode).toBeUndefined();
  await expect
    .poll(() => responseBeforeCa.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toMatch(/unable to get local issuer certificate/i);

  await certificatesFlow.setCaCertificate(
    collection,
    path.join(__dirname, "../../misc/fixtures/mtls-ca.pem"),
  );

  const requestAfterCa = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
  });
  const responseAfterCa = await httpRequestFlow.send(requestAfterCa);
  expect(responseAfterCa.statusCode).toBe(200);
  expect(responseAfterCa.body).toMatchObject({
    headers: expect.objectContaining({ host: "localhost:4062" }),
  });
});
