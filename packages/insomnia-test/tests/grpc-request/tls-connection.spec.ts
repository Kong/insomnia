import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, GRPC_SERVER_TLS,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify gRPC Request Over a TLS Connection", async ({ user }) => {
  const { grpcRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;

  await preferencesFlow.set({ validateSSL: false });

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
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
