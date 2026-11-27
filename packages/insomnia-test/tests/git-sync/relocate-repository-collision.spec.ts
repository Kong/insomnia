import * as fs from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT } from '@package/misc/fixtures';
import { GIT_CREDENTIAL, test } from '@package/misc/git-fixtures';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

test(
  "Verify relocating a Git Sync project's repository shows an error when the destination folder already exists",
  async ({ user }) => {
    const { preferencesFlow, workspaceFlow } = user.flowManager;
    const { projectSettingsPage } = user.pageManager;

    await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
    const project = await workspaceFlow.cloneGitProject(
      new Project(faker.string.alphanumeric(10), ProjectType.Git),
      GIT_CREDENTIAL.name,
    );
    await workspaceFlow.openSettings(project);
    const destinationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-relocate-collision-'));
    fs.writeFileSync(path.join(destinationDir, 'existing-file.txt'), '');
    await user.flowManager.context.stubFileChooser(destinationDir);
    await projectSettingsPage.relocateRepository();

    await expect
      .poll(() => projectSettingsPage.getRelocationError(), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toMatch(/already has files in it and isn't a git repository/i);
  },
);
