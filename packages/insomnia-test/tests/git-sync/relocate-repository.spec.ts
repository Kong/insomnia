import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { DEFAULT_TIMEOUT } from "../../misc/fixtures";
import { expect, GIT_CREDENTIAL, test } from "../../misc/git-fixtures";
import { Project } from "../../models/project";

test("Verify relocating a Git Sync project's repository to a new folder updates the displayed path", async ({
  user,
}) => {
  const { preferencesFlow, workspaceFlow } = user.flowManager;
  const { projectSettingsPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  await workspaceFlow.openSettings(project);
  const destinationDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "insomnia-relocate-dest-"),
  );
  await projectSettingsPage.relocateRepository(destinationDir);

  await expect
    .poll(() => projectSettingsPage.getRepositoryPath(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(destinationDir);
  expect(fs.existsSync(destinationDir)).toBe(true);
});
