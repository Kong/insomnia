import * as path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, GRPC_SERVER_MTLS,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Client Certificate Toggle Controls mTLS Enforcement For gRPC Request", async ({
  user,
}) => {
  const { workspaceFlow, grpcRequestFlow, preferencesFlow, certificatesFlow } =
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

  await expect(
    grpcRequestFlow.create(collection, {
      name: faker.string.alphanumeric(10),
      url: GRPC_SERVER_MTLS,
      method: "/hello.HelloService/SayHello",
      body: JSON.stringify({ greeting: faker.person.firstName() }),
    }),
  ).rejects.toThrow(/Client Certificate Required/);
  await user.page.keyboard.press("Escape");

  await certificatesFlow.addClientCertificate(collection, {
    host: "localhost",
    cert: path.join(__dirname, "../../misc/fixtures/mtls-client-cert.pem"),
    key: path.join(__dirname, "../../misc/fixtures/mtls-client-key.pem"),
  });

  const greeting = faker.person.firstName();
  const requestWithCert = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER_MTLS,
    method: "/hello.HelloService/SayHello",
    body: JSON.stringify({ greeting }),
  });
  const responseWithCert = await grpcRequestFlow.send(requestWithCert);

  await certificatesFlow.setClientCertificateEnabled(
    collection,
    "localhost",
    false,
  );

  await expect(
    grpcRequestFlow.create(collection, {
      name: faker.string.alphanumeric(10),
      url: GRPC_SERVER_MTLS,
      method: "/hello.HelloService/SayHello",
      body: JSON.stringify({ greeting: faker.person.firstName() }),
    }),
  ).rejects.toThrow(/Client Certificate Required/);

  expect(responseWithCert.status).toEqual({ code: "0", message: "OK" });
  expect(responseWithCert.message).toMatchObject({ reply: `hello ${greeting}` });
});
