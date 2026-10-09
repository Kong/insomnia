import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, GRPC_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Duplicating a gRPC Request With a Bidirectional Streaming Method Selected", async ({
  user,
}) => {
  const { grpcRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER,
    method: "/hello.HelloService/BidiHello",
  });
  const duplicatedName = `${request.name} (Copy)`;
  await workspaceFlow.duplicate(request, duplicatedName);

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
