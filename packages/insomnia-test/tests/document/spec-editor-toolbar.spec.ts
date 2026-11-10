import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { SpecFormat } from "@package/enums/spec-format";
import { test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test("Verify Spec Editor Toolbar's Generate Menu, Format Switch, And Preview Toggle", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, specPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      JSON.stringify({
        openapi: "3.0.0",
        info: { title: faker.commerce.productName(), version: "1.0.0" },
        paths: {
          [`/${faker.word.sample()}`]: {
            get: { responses: { "200": { description: "OK" } } },
          },
        },
      }),
    ),
  );
  const formatBefore = await specPage.getFormat();
  const otherFormat = Object.values(SpecFormat).find(
    (format) => format !== formatBefore,
  )!;
  await specPage.selectFormat(otherFormat);
  const formatAfter = await specPage.getFormat();

  const previewBefore = await specPage.isPreviewOpen();
  const previewAfterOpen = await specPage.togglePreview();
  const previewAfterClose = await specPage.togglePreview();

  expect(collection.version).toBe("OpenAPI 3.0.0");
  expect(formatAfter).toBe(otherFormat);
  expect(formatAfter).not.toBe(formatBefore);
  expect(previewBefore).toBe(false);
  expect(previewAfterOpen).toBe(true);
  expect(previewAfterClose).toBe(false);
});

test("Verify Spec Editor Toolbar's Format Switch And Preview Toggle With A YAML Spec", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, specPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(
      faker.string.alphanumeric(10),
      `openapi: 3.0.0
info:
  title: ${faker.commerce.productName()}
  version: 1.0.0
paths:
  /${faker.word.sample()}:
    get:
      responses:
        '200':
          description: OK
`,
    ),
  );
  const formatBefore = await specPage.getFormat();
  await specPage.selectFormat(SpecFormat.JSON);
  const formatJson = await specPage.getFormat();
  await specPage.selectFormat(SpecFormat.YAML);
  const formatYaml = await specPage.getFormat();

  const previewBefore = await specPage.isPreviewOpen();
  const previewAfterOpen = await specPage.togglePreview();
  const previewAfterClose = await specPage.togglePreview();

  expect(collection.version).toBe("OpenAPI 3.0.0");
  expect(formatBefore).toBe(SpecFormat.YAML);
  expect(formatJson).toBe(SpecFormat.JSON);
  expect(formatYaml).toBe(SpecFormat.YAML);
  expect(previewBefore).toBe(false);
  expect(previewAfterOpen).toBe(true);
  expect(previewAfterClose).toBe(false);
});
