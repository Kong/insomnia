import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContentType } from "../../enums/content-type";
import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify the response Tag's Trigger Behavior Controls When its Dependency Request is Resent", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { page } = user;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const marker = faker.string.alphanumeric(10);
  const dependency = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    body: { mimeType: ContentType.JSON, text: JSON.stringify({ marker }) },
  });

  const filter = `b64::${Buffer.from("$.json.marker").toString("base64")}::46b`;
  const createDependent = (trigger: string, maxAge: number) =>
    httpRequestFlow.create(collection, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Post,
      url: `${HTTP_SERVER}/post`,
      body: {
        mimeType: ContentType.Plain,
        text: `{% response 'body', '${dependency.id}', '${filter}', '${trigger}', ${maxAge} %}`,
      },
    });
  const neverRequest = await createDependent("never", 60);
  const noHistoryRequest = await createDependent("no-history", 60);
  const whenExpiredRequest = await createDependent("when-expired", 0);
  const alwaysRequest = await createDependent("always", 60);

  const neverFailure = httpRequestFlow.send(neverRequest);
  await neverFailure.catch(() => {});
  await page.keyboard.press("Escape");
  const noHistory = await httpRequestFlow.send(noHistoryRequest);
  const whenExpired = await httpRequestFlow.send(whenExpiredRequest);
  const always = await httpRequestFlow.send(alwaysRequest);

  await expect(neverFailure).rejects.toThrow(/No responses for request/);
  expect(noHistory.statusCode).toBe(200);
  expect(noHistory.body).toMatchObject({ data: marker });
  expect(whenExpired.statusCode).toBe(200);
  expect(whenExpired.body).toMatchObject({ data: marker });
  expect(always.statusCode).toBe(200);
  expect(always.body).toMatchObject({ data: marker });
});
