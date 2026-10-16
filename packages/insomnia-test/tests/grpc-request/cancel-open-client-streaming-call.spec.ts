import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, GRPC_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Cancelling an Open gRPC Client Streaming Call", async ({
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
    method: "/hello.HelloService/LotsOfGreetings",
  });
  await grpcRequestFlow.start(request);
  for (const name of names.slice(0, 3)) {
    await grpcRequestFlow.streamMessage(
      request,
      JSON.stringify({ greeting: name }),
    );
  }
  const response = await grpcRequestFlow.cancel(request);

  expect(response.status!).toMatchObject({
    code: "1",
    message: "Cancelled on client",
  });
});
