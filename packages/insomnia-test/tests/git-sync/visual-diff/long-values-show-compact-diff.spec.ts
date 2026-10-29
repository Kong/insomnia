import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, GIT_CREDENTIAL, pushServerFile, test } from "../../../misc/git-fixtures";
import { Project } from '../../../models/project';
import { planLongValues } from './helpers';

test('Verify long changed values render as a compact diff with unchanged lines folded and short values stay inline', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const { longRequest, shortRequest, workspace, totalLines, build } = planLongValues();
  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const seedFiles: Record<string, string> = { [fileName]: build(false) };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.cloneGitProject(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, fileName), build(true));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  const body = await gitSyncPage.getEntityCardCompactDiff(longRequest, 'Body');
  const script = await gitSyncPage.getEntityCardCompactDiff(longRequest, 'Scripts');
  const spec = await gitSyncPage.getEntityCardCompactDiff(workspace, undefined, 'API Spec');
  const shortValueIsCompact = await gitSyncPage.hasEntityCardCompactDiff(shortRequest);
  const shortValueText = await gitSyncPage.getEntityCardText(shortRequest);

  for (const diff of [body, script, spec]) {
    expect(diff.editors).toBe(1);
    expect(diff.foldedRegions).toBeGreaterThan(0);
    expect(diff.drawnLines).toBeLessThan(totalLines);
  }
  expect(shortValueIsCompact).toBe(false);
  expect(shortValueText).toContain('short old');
  expect(shortValueText).toContain('short new');
});
