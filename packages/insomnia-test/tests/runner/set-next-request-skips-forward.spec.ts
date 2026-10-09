import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;
const iterations = 2;

test("Verify insomnia.execution.setNextRequest Skips a Request", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const nameC = faker.string.alphanumeric(10);
  const requestC = await httpRequestFlow.create(collection, {
    name: nameC,
    method: HttpMethod.Post,
    url,
  });
  const requestB = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
  });
  const requestA = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `insomnia.execution.setNextRequest('${nameC}');`,
  });

  const result = await workspaceFlow.run(collection, { iterations, delay: 0 });

  const iterationResults = result.iterationResults.get("All")!;
  expect(iterationResults).toHaveLength(iterations);
  for (let i = 0; i < iterations; i++) {
    expect(iterationResults[i].results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: requestA!.name, status: "200 OK" }),
        expect.objectContaining({ name: requestB!.name, status: "SKIPPED" }),
        expect.objectContaining({ name: requestC!.name, status: "200 OK" }),
      ]),
    );
  }
});
