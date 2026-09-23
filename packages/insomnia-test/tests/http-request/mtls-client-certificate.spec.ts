import path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import {
  DEFAULT_TIMEOUT,
  expect,
  HTTP_SERVER_MTLS,
  test,
} from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER_MTLS}/post`;

test("Verify Client Certificate Toggle Controls mTLS Enforcement For HTTP Request", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow, certificatesFlow } =
    user.flowManager;

  await preferencesFlow.set({
    validateSSL: false,
    dataFolders: [path.join(__dirname, "../../misc/fixtures")],
  });

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const requestBeforeCert = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
  });
  const responseBeforeCert = await httpRequestFlow.send(requestBeforeCert);
  expect(responseBeforeCert.statusCode).toBeUndefined();
  await expect
    .poll(() => responseBeforeCert.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toMatch(/certificate required/i);

  await certificatesFlow.addClientCertificate(collection, {
    host: "localhost",
    cert: path.join(__dirname, "../../misc/fixtures/mtls-client-cert.pem"),
    key: path.join(__dirname, "../../misc/fixtures/mtls-client-key.pem"),
  });

  const requestWithCert = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
  });
  const responseWithCert = await httpRequestFlow.send(requestWithCert);
  expect(responseWithCert.statusCode).toBe(200);
  expect(responseWithCert.body).toMatchObject({
    headers: expect.objectContaining({ host: "localhost:4063" }),
  });

  await certificatesFlow.setClientCertificateEnabled(
    collection,
    "localhost",
    false,
  );

  const requestAfterDisable = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
  });
  const responseAfterDisable = await httpRequestFlow.send(requestAfterDisable);
  expect(responseAfterDisable.statusCode).toBeUndefined();
  await expect
    .poll(() => responseAfterDisable.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toMatch(/certificate required/i);
});
