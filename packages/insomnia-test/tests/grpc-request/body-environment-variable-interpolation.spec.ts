import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../enums/project-types";
import { GRPC_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import { Project } from "../../models/project";

test("Verify Environment Variable Interpolation Inside a gRPC Request Body", async ({
  user,
}) => {
  const { environmentFlow, grpcRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const greetingValue = faker.person.firstName();
  const environment = await environmentFlow.createBaseEnvironment(project, {
    name: faker.string.alphanumeric(10),
    kvPairData: [
      {
        id: "greeting",
        name: "greeting",
        value: greetingValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  await environmentFlow.link(collection, environment);

  const request = await grpcRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: GRPC_SERVER,
    method: "/hello.HelloService/SayHello",
    body: JSON.stringify({ greeting: "{{greeting}}" }),
  });
  const response = await grpcRequestFlow.send(request);

  expect(response.status).toEqual({ code: "0", message: "OK" });
  expect(response.message).toMatchObject({ reply: `hello ${greetingValue}` });
});
