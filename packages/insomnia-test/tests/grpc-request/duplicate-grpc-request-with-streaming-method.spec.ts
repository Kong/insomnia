import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "@package/enums/project-types";
import { GRPC_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify Duplicating a gRPC Request With a Bidirectional Streaming Method Selected", async ({
  user,
}) => {
  const { grpcRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER,
    method: "/hello.HelloService/BidiHello",
  });
  const duplicatedName = `${request.name} (Copy)`;
  await workspaceFlow.duplicateRequest(request, duplicatedName);

  const greetingName = faker.person.firstName();
  const duplicated = await grpcRequestFlow.get(duplicatedName);
  await grpcRequestFlow.start(duplicated!);
  await grpcRequestFlow.streamMessage(
    duplicated!,
    JSON.stringify({ greeting: greetingName }),
  );
  const response = await grpcRequestFlow.commit(duplicated!);

  expect(duplicated).toBeTruthy();
  expect(duplicated!.method).toBe(request.method);
  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.messages).toEqual([{ reply: `hello ${greetingName}` }]);
});
