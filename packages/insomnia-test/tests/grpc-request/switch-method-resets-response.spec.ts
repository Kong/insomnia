import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { GRPC_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Switching gRPC Methods Resets the Response Pane", async ({
  user,
}) => {
  const { grpcRequestFlow, workspaceFlow } = user.flowManager;
  const { grpcRequestPage, responsePage } = user.pageManager;

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
    body: JSON.stringify({ greeting: faker.person.firstName() }),
  });
  const response = await grpcRequestFlow.send(request);
  await grpcRequestPage.setMethod("/hello.HelloService/LotsOfReplies");

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(await responsePage.getGrpcStatus()).toBeUndefined();
  expect(await responsePage.getGrpcMessage()).toBeUndefined();
});
