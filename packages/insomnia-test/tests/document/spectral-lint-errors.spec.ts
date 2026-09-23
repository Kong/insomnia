import { faker } from "@faker-js/faker";

import { LintSeverity } from "../../enums/lint-severity";
import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Spectral Lint Errors Surface With A Line Reference", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createInEmptyState(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const requestPath = `/${faker.word.sample()}`;
  await workspacePage.setSpecification(
    JSON.stringify({
      openapi: "3.0.0",
      info: { title: faker.commerce.productName(), version: "1.0.0" },
      paths: {
        [requestPath]: { get: { responses: { "200": { description: "OK" } } } },
      },
    }),
  );
  const baseline = await workspacePage.getLintSummary();

  await workspacePage.setSpecification(
    JSON.stringify({
      openapi: "3.0.0",
      info: { version: "1.0.0" },
      paths: {
        [requestPath]: { get: { responses: { "200": { description: "OK" } } } },
      },
    }),
  );
  const corrupted = await workspaceFlow.getLintState(1);
  expect(baseline).toBe("none");
  expect(corrupted.errors).toBe(1);

  const error = corrupted.entries
    .find((entry) => entry.severity === LintSeverity.Error);
  expect(error!.lineRefs.length).toBeGreaterThan(0);
  expect(error!.lineRefs.at(0)).toBe("Ln 1");
});
