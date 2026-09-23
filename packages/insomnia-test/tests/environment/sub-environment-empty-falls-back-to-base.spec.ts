import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { EnvironmentKvPairDataType } from "../../models/environment";
import type { HttpRequest } from "../../models/http-request";
import { Project } from "../../models/project";

const sharedVariable = "shared";

test("Verify an empty sub-environment falls back to the base environment until it defines its own value", async ({
  user,
}) => {
  const { environmentFlow, httpRequestFlow, workspaceFlow } = user.flowManager;
  const { environmentPage, workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const baseValue = faker.string.alphanumeric(10);
  const subValue = faker.string.alphanumeric(10);

  const base = await environmentFlow.create(project, {
    name: "Base Environment",
    kvPairData: [
      {
        id: "",
        name: sharedVariable,
        value: baseValue,
        type: EnvironmentKvPairDataType.STRING,
        enabled: true,
      },
    ],
  });
  const sub = await environmentFlow.create(base, {
    name: faker.string.alphanumeric(10),
  });
  await environmentFlow.link(collection, sub);

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post?value={{${sharedVariable}}}`,
  } satisfies HttpRequest);
  const beforeOwnValue = await httpRequestFlow.send(request);

  const baseNode = await workspacePage.findItemNode(base);
  await workspacePage.clickNode(baseNode!);
  await environmentPage.selectEnvironment(sub.name);
  await environmentPage.setVariables([
    {
      id: "",
      name: sharedVariable,
      value: subValue,
      type: EnvironmentKvPairDataType.STRING,
      enabled: true,
    },
  ]);
  const afterOwnValue = await httpRequestFlow.send(request);

  expect(beforeOwnValue.statusCode).toBe(200);
  expect(beforeOwnValue.body).toMatchObject({ args: { value: baseValue } });
  expect(afterOwnValue.statusCode).toBe(200);
  expect(afterOwnValue.body).toMatchObject({ args: { value: subValue } });
});
