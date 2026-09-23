import * as path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../enums/http-method";
import { ProjectType } from "../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";

const url = `${HTTP_SERVER}/post`;
const dataFilePath = path.join(__dirname, "runner-data.json");
const expectedGreetings = ["hello", "bonjour", "hola"];

test("Verify Uploaded Data File Drives Runner Iterations", async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `
      const expected = ${JSON.stringify(expectedGreetings)}[insomnia.info.iteration - 1];
      insomnia.test('greeting matches uploaded row', () => {
        insomnia.expect(insomnia.iterationData.get('greeting')).to.equal(expected);
      });
    `,
  });

  const result = await workspaceFlow.run(collection, { dataFilePath });

  expect(result.testResultCount).toEqual({
    passed: expectedGreetings.length,
    total: expectedGreetings.length,
  });
});
