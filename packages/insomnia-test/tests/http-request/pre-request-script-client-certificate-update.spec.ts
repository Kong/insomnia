import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { certPath } from "../../misc/certs";
import { DEFAULT_TIMEOUT, HTTP_SERVER_MTLS, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER_MTLS}/post`;

test("Verify pre-request script reads and replaces the client certificate via insomnia.request.certificate", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow, certificatesFlow } =
    user.flowManager;

  await preferencesFlow.set({
    validateSSL: false,
    dataFolders: [path.join(__dirname, "../../misc/fixtures")],
  });

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await certificatesFlow.addClientCertificate(collection, {
    host: "localhost",
    cert: certPath("mtls-client-cert.pem"),
    key: certPath("mtls-client-key.pem"),
  });

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    preRequestScript: `
      console.log('original cert:', JSON.stringify(insomnia.request.certificate.cert));
      console.log('original key:', JSON.stringify(insomnia.request.certificate.key));
      insomnia.request.certificate.update({
        disabled: false,
        key: { src: '${certPath("mtls-client-key.pem")}' },
        cert: { src: '${certPath("mtls-client-cert.pem")}' },
        passphrase: '',
      });
    `,
  });
  const responseView = await httpRequestFlow.send(request);

  expect(responseView.statusCode).toBe(200);
  await expect
    .poll(() => responseView.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("Adding SSL PEM certificate");
  await expect
    .poll(() => responseView.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("Adding SSL KEY certificate");
  await expect
    .poll(() => responseView.console?.(), { timeout: DEFAULT_TIMEOUT })
    .toContain("original cert:");
});
