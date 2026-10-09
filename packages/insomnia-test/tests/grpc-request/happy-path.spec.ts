import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, GRPC_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { Project } from "../../models/project";

test("Verify Create gRPC Request", async ({ user }) => {
  const { environmentFlow, grpcRequestFlow, workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const baseEnvironment = await environmentFlow.create(project, {
    name: faker.string.alphanumeric(10),
  });
  const subEnvironment = await environmentFlow.create(baseEnvironment, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "grpcUrl",
        name: "grpcUrl",
        value: GRPC_SERVER,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, subEnvironment);

  const greetingName = faker.person.firstName();
  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: "{{grpcUrl}}",
    method: "/hello.HelloService/SayHello",
    body: JSON.stringify({ greeting: greetingName }),
  });
  const response = await grpcRequestFlow.send(request);
  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.message).toMatchObject({ reply: `hello ${greetingName}` });

  await workspaceFlow.delete(request);
  const deletedNames = [request.name];
  await expect
    .poll(
      async () => {
        const names = (await workspacePage.getNodes()).map((node) => node.name);
        return deletedNames.filter((name) => names.includes(name));
      },
      { timeout: 10_000 },
    )
    .toEqual([]);
});

test("Verify gRPC Server Streaming RPC", async ({ user }) => {
  const { grpcRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const names = Array.from({ length: 10 }, () => faker.person.firstName());
  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER,
    method: "/hello.HelloService/LotsOfReplies",
    body: JSON.stringify({ greeting: names.join(",") }),
  });
  const response = await grpcRequestFlow.send(request);

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.messages).toEqual(
    names.map((name) => ({ reply: `hello ${name}` })),
  );
});

test("Verify gRPC Client Streaming RPC", async ({ user }) => {
  const { grpcRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const names = Array.from({ length: 5 }, () => faker.person.firstName());
  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER,
    method: "/hello.HelloService/LotsOfGreetings",
  });
  await grpcRequestFlow.start(request);
  for (const name of names) {
    await grpcRequestFlow.streamMessage(
      request,
      JSON.stringify({ greeting: name }),
    );
  }
  const response = await grpcRequestFlow.commit(request);

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.message).toEqual({ reply: `hello ${names.join(", ")}` });
});

test("Verify gRPC Bidirectional Streaming RPC", async ({ user }) => {
  const { grpcRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const names = Array.from({ length: 5 }, () => faker.person.firstName());
  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER,
    method: "/hello.HelloService/BidiHello",
  });
  await grpcRequestFlow.start(request);
  for (const name of names) {
    await grpcRequestFlow.streamMessage(
      request,
      JSON.stringify({ greeting: name }),
    );
  }
  const response = await grpcRequestFlow.commit(request);

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.messages).toEqual(
    names.map((name) => ({ reply: `hello ${name}` })),
  );
});
