import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "@package/enums/project-types";
import { GRPC_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify Re-sending a Completed gRPC Unary Request Reflects the New Body", async ({
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
    method: "/hello.HelloService/SayHello",
    body: JSON.stringify({ greeting: "Alice" }),
  });
  const firstResponse = await grpcRequestFlow.send(request);
  const secondGreetingName = faker.person.firstName();
  await grpcRequestFlow.setBody(
    request,
    JSON.stringify({ greeting: secondGreetingName }),
  );
  const secondResponse = await grpcRequestFlow.send(request);

  expect(firstResponse.message).toMatchObject({ reply: "hello Alice" });
  expect(secondResponse.status).toEqual({ code: "0", message: "OK" });
  expect(secondResponse.message).toMatchObject({
    reply: `hello ${secondGreetingName}`,
  });
});
