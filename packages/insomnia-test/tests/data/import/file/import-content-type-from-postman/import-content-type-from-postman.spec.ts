import * as path from "node:path";

import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../../../../enums/http-method";
import { ProjectType } from "../../../../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../../../../misc/fixtures";
import type { HttpRequest } from "../../../../../models/http-request";
import { Project } from "../../../../../models/project";

test("Import Generates Content-Type Header From Postman File", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const filePath = path.join(
    __dirname,
    "import-content-type-from-postman.json",
  );
  await importFlow.importFile(project, filePath);

  const request = {
    name: "New Request",
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
  } satisfies HttpRequest;
  const response = await httpRequestFlow.send(request);

  expect(response.statusCode).toBe(200);
  expect(response.body).toMatchObject({
    headers: expect.objectContaining({
      "content-type": expect.stringContaining(
        "application/x-www-form-urlencoded",
      ),
    }),
  });
});
