import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";

import { faker } from "@faker-js/faker";
import { ProjectType } from "@package/enums/project-types";
import { test } from "@package/misc/git-fixtures";
import { Project } from "@package/models/project";
import { expect } from "@playwright/test";

test(
  "Verify opening a folder already adopted by another project shows a collision warning and disables Open",
  async ({ user }) => {
    const { workspaceFlow } = user.flowManager;
    const { projectSettingsPage } = user.pageManager;

    const folderPath = fs.mkdtempSync(
      path.join(os.tmpdir(), "insomnia-open-local-folder-collision-"),
    );
    await workspaceFlow.openLocalGitFolder(
      new Project(faker.string.alphanumeric(10), ProjectType.Git, folderPath),
    );

    await expect(async () => {
      return workspaceFlow.openLocalGitFolder(
        new Project(faker.string.alphanumeric(10), ProjectType.Git, folderPath),
      );
    }).rejects.toThrow();

    await expect
      .poll(() => projectSettingsPage.getOpenFolderCollisionError())
      .toMatch(/already connected to this folder/i);
  },
);
