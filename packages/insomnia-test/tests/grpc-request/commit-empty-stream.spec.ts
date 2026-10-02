import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, GRPC_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Committing a gRPC Client Streaming Call With No Messages Sent", async ({
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
    method: "/hello.HelloService/LotsOfGreetings",
  });
  await grpcRequestFlow.start(request);
  const response = await grpcRequestFlow.commit(request);

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.message).toEqual({ reply: "hello " });
});

test("Verify Committing a gRPC Bidirectional Streaming Call With No Messages Sent", async ({
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
  await grpcRequestFlow.start(request);
  const response = await grpcRequestFlow.commit(request);

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.messages).toEqual([]);
});
