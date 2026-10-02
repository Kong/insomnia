import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const unreachableGrpcUrl = "localhost:19999";

test("Verify gRPC Server Reflection Fails Against an Unreachable Server", async ({
  user,
}) => {
  const { grpcRequestFlow, workspaceFlow } = user.flowManager;
  const { grpcRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: unreachableGrpcUrl,
  });

  expect(request.url).toBe(unreachableGrpcUrl);
  await expect(grpcRequestPage.fetchServerReflection()).rejects.toThrow(
    /Uh Oh!.*UNAVAILABLE.*ECONNREFUSED/s,
  );
});
