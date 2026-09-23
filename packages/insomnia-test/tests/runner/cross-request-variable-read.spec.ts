import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify a Request Can Read a Variable Set by an Earlier Request in the Same Run", async ({
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

  const sharedKey = faker.string.alpha(8);
  const sharedValue = faker.string.alphanumeric(10);

  const requestReader = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `insomnia.test('reads shared var', () => { insomnia.expect(insomnia.variables.get('${sharedKey}')).to.equal('${sharedValue}'); });`,
  });
  const requestWriter = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url,
    afterResponseScript: `insomnia.variables.set('${sharedKey}', '${sharedValue}');`,
  });

  const result = await workspaceFlow.run(collection, {
    iterations: 1,
    delay: 0,
  });

  expect(result.testResultCount).toEqual({ passed: 1, total: 1 });
  expect(result.iterationResults.get("All")).toEqual([
    {
      iteration: 1,
      results: expect.arrayContaining([
        expect.objectContaining({
          name: requestWriter!.name,
          status: "200 OK",
        }),
        expect.objectContaining({
          name: requestReader!.name,
          status: "200 OK",
        }),
      ]),
    },
  ]);
});
