import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { expect, test } from "../../misc/fixtures";
import { Collection, Info, Specification } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify creating, renaming, duplicating, and deleting collections", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const specPath = `/${faker.word.sample()}`;
  const spec = new Specification(
    new Info(faker.company.name(), faker.system.semver()),
    {
      [specPath]: {
        get: {
          operationId: "listItems",
          responses: { "200": { description: "OK" } },
        },
      },
    },
  );
  const collectionA = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10), spec),
  );
  const collectionB = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );

  const renamedCollectionAName = faker.string.alphanumeric(10);
  const renamedCollectionA = (await workspaceFlow.rename(
    collectionA,
    renamedCollectionAName,
  )) as Collection;

  const renamedCollectionBName = faker.string.alphanumeric(10);
  const renamedCollectionB = (await workspaceFlow.rename(
    collectionB,
    renamedCollectionBName,
  )) as Collection;

  const duplicatedCollectionAName = faker.string.alphanumeric(10);
  const duplicatedCollectionA = (await workspaceFlow.duplicate(
    renamedCollectionA,
    duplicatedCollectionAName,
  )) as Collection;

  const duplicatedCollectionBName = faker.string.alphanumeric(10);
  const duplicatedCollectionB = (await workspaceFlow.duplicate(
    renamedCollectionB,
    duplicatedCollectionBName,
  )) as Collection;

  const duplicatedCollectionASpec =
    await workspaceFlow.getCollectionSpec(duplicatedCollectionA);

  await workspaceFlow.delete(duplicatedCollectionA);
  await workspaceFlow.delete(duplicatedCollectionB);

  const nodesBeforeProjectDelete = await workspacePage.getNodes();
  const idsBeforeProjectDelete = new Set(
    nodesBeforeProjectDelete.map((n) => n._id),
  );

  await workspaceFlow.delete(project);

  const idsAfterProjectDelete = new Set(
    (await workspacePage.getNodes()).map((n) => n._id),
  );

  expect(
    nodesBeforeProjectDelete.find((n) => n._id === collectionA.id)?.name,
  ).toBe(renamedCollectionAName);
  expect(
    nodesBeforeProjectDelete.find((n) => n._id === collectionB.id)?.name,
  ).toBe(renamedCollectionBName);
  expect(idsBeforeProjectDelete.has(duplicatedCollectionA.id!)).toBe(false);
  expect(idsBeforeProjectDelete.has(duplicatedCollectionB.id!)).toBe(false);
  expect(idsAfterProjectDelete.has(project.id!)).toBe(false);
  expect(duplicatedCollectionASpec?.specification?.info).toMatchObject({
    title: spec.info.title,
    version: spec.info.version,
  });
});
