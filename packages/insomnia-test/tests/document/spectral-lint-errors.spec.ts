import { faker } from "@faker-js/faker";
import { LintSeverity } from "@package/enums/lint-severity";
import { ProjectType } from "@package/enums/project-types";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Spectral Lint Errors Surface With A Line Reference", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, specPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const projectNode = (await workspacePage.findItemNode(
    project,
    TreeNodeType.Project,
  ))!;
  await workspacePage.expand(projectNode);
  const projectChildren = (await workspacePage.getTree())
    .flatten()
    .find((node) => node._id === projectNode._id)!.children;
  expect(projectChildren.map((node) => node._id)).toEqual([
    `empty-project-${projectNode._id}`,
  ]);
  expect(projectChildren[0].type).toBe(TreeNodeType.Empty);

  await workspaceFlow.createInEmptyState(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const requestPath = `/${faker.word.sample()}`;
  await specPage.setSpecification(
    JSON.stringify({
      openapi: "3.0.0",
      info: { title: faker.commerce.productName(), version: "1.0.0" },
      paths: {
        [requestPath]: { get: { responses: { "200": { description: "OK" } } } },
      },
    }),
  );
  const baseline = await workspaceFlow.getLintState();

  await specPage.setSpecification(
    JSON.stringify({
      openapi: "3.0.0",
      info: { version: "1.0.0" },
      paths: {
        [requestPath]: { get: { responses: { "200": { description: "OK" } } } },
      },
    }),
  );
  const corrupted = await workspaceFlow.getLintState(1);
  expect(baseline.errors).toBe(0);
  expect(corrupted.errors).toBe(1);

  const error = corrupted.entries
    .find((entry) => entry.severity === LintSeverity.Error);
  expect(error!.lineRefs.length).toBeGreaterThan(0);
  expect(error!.lineRefs.at(0)).toBe("Ln 1");
});

test("Verify Spectral Lint Errors Surface With A Line Reference In A YAML Spec", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, specPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  await workspaceFlow.createInEmptyState(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const requestPath = `/${faker.word.sample()}`;
  await specPage.setSpecification(
    `openapi: 3.0.0
info:
  title: ${faker.commerce.productName()}
  version: 1.0.0
paths:
  ${requestPath}:
    get:
      responses:
        '200':
          description: OK
`,
  );
  const baseline = await workspaceFlow.getLintState();

  await specPage.setSpecification(
    `openapi: 3.0.0
info:
  version: 1.0.0
paths:
  ${requestPath}:
    get:
      responses:
        '200':
          description: OK
`,
  );
  const corrupted = await workspaceFlow.getLintState(1);
  expect(baseline.errors).toBe(0);
  expect(corrupted.errors).toBe(1);

  const error = corrupted.entries
    .find((entry) => entry.severity === LintSeverity.Error);
  expect(error!.lineRefs.length).toBeGreaterThan(0);
  expect(error!.lineRefs.at(0)).toBe("Ln 2");
});
