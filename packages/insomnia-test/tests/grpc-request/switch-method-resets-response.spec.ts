import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, GRPC_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Switching gRPC Methods Resets the Response Pane", async ({
  user,
}) => {
  const { grpcRequestFlow, workspaceFlow } = user.flowManager;
  const { grpcRequestPage, responsePage } = user.pageManager;

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
    method: "/hello.HelloService/SayHello",
    body: JSON.stringify({ greeting: faker.person.firstName() }),
  });
  const response = await grpcRequestFlow.send(request);
  await grpcRequestPage.setMethod("/hello.HelloService/LotsOfReplies");

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(await responsePage.getGrpcStatus()).toBeUndefined();
  expect(await responsePage.getGrpcMessage()).toBeUndefined();
});
