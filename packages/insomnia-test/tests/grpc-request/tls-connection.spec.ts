import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "@package/enums/project-types";
import { GRPC_SERVER_TLS, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify gRPC Request Over a TLS Connection", async ({ user }) => {
  const { grpcRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.set({ validateSSL: false });

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const greetingName = faker.person.firstName();
  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER_TLS,
    method: "/hello.HelloService/SayHello",
    body: JSON.stringify({ greeting: greetingName }),
  });
  const response = await grpcRequestFlow.send(request);

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.message).toMatchObject({ reply: `hello ${greetingName}` });
});
