import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { GRPC_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify a gRPC Server-Side Business Error Status Is Surfaced", async ({
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
    body: JSON.stringify({ greeting: "" }),
  });

  await expect(grpcRequestFlow.send(request)).rejects.toThrow(
    /INVALID_ARGUMENT.*greeting is required/,
  );
});
