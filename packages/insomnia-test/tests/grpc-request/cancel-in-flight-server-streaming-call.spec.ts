import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, GRPC_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Cancelling an In-Flight gRPC Server Streaming Call", async ({
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

  const names = Array.from({ length: 5 }, () => faker.person.firstName());
  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER,
    method: "/hello.HelloService/LotsOfReplies",
    body: JSON.stringify({ greeting: names.join(",") }),
    headers: [{ name: "x-reply-delay-ms", value: "1000" }],
  });
  await grpcRequestFlow.start(request);
  const response = await grpcRequestFlow.cancel(request);

  expect(response.status?.code).not.toEqual("0");
  expect(response.messages?.length).toBeLessThan(names.length);
});
