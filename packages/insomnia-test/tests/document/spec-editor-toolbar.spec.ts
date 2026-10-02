import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { SpecFormat } from "../../enums/spec-format";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify Spec Editor Toolbar's Generate Menu, Format Switch, And Preview Toggle", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );

  const collection = await workspaceFlow.create(
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
  const formatBefore = await workspacePage.getFormat();
  const otherFormat =
    formatBefore === SpecFormat.JSON ? SpecFormat.YAML : SpecFormat.JSON;
  await workspacePage.selectFormat(otherFormat);
  const formatAfter = await workspacePage.getFormat();

  const previewBefore = await workspacePage.isPreviewOpen();
  const previewAfterOpen = await workspacePage.togglePreview();
  const previewAfterClose = await workspacePage.togglePreview();

  expect(collection.version).toBe("OpenAPI 3.0.0");
  expect(formatAfter).toBe(otherFormat);
  expect(formatAfter).not.toBe(formatBefore);
  expect(previewBefore).toBe(false);
  expect(previewAfterOpen).toBe(true);
  expect(previewAfterClose).toBe(false);
});
