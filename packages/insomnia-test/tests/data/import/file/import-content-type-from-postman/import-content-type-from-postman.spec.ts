import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import type { HttpRequest } from "@package/models/http-request";
import { Project } from "@package/models/project";

test("Import Generates Content-Type Header From Postman File", async ({
  user,
}) => {
  const { httpRequestFlow, importFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const filePath = path.join(
    import.meta.dirname,
    "import-content-type-from-postman.json",
  );
  await importFlow.importFile(project, filePath);

  const request = {
    name: "New Request",
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
  } satisfies HttpRequest;
  const responseView = await httpRequestFlow.send(request);

  expect(responseView.statusBar.code).toBe(200);
  expect(responseView.preview).toMatchObject({
    headers: expect.objectContaining({
      "content-type": expect.stringContaining(
        "application/x-www-form-urlencoded",
      ),
    }),
  });
});
