import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

const url = `${HTTP_SERVER}/post`;

test("Verify Skipping and Canceling an In-Flight Runner Run", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { runnerPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const names = Array.from({ length: 4 }, () => faker.string.alphanumeric(10));
  for (const name of names) {
    await httpRequestFlow.create(collection, {
      name,
      method: HttpMethod.Post,
      url,
    });
  }

  await workspaceFlow.openRunner(collection, { iterations: 2, delay: 3000 });
  await runnerPage.clickRun();
  const skippedName = names[1];
  await runnerPage.skipItem(skippedName);
  await runnerPage.cancelRun();

  await expect
    .poll(async () => (await runnerPage.getStatus())?.running, {
      timeout: 15_000,
    })
    .toBe(false);
  const status = await runnerPage.getStatus();
  const skippedStatus = await runnerPage.getItemStatus(skippedName);

  expect(status?.skipped).toBe(1);
  expect(status?.canceled).toBeGreaterThan(0);
  expect(skippedStatus).toBe("SKIPPED");
});
