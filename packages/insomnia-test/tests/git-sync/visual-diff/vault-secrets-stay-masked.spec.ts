import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile,test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';

test('Verify vault-backed secrets are listed by name and never shown in the clear in an environment card', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const buildEnvironmentFile = (name: string, data: Record<string, unknown>, id: string) =>
    JSON.stringify(
      {
        type: 'environment.insomnia.rest/5.0',
        schema_version: '5.1',
        name,
        meta: { id: `wrk_${id}`, created: 1000, modified: 1000, description: '' },
        environments: { name: 'Base Environment', meta: { id: `env_${id}`, created: 1000, modified: 1000, isPrivate: false }, data },
      },
      null,
      2,
    );

  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const environmentName = faker.string.alpha(10);
  const secretName = faker.string.alpha(8);
  const oldSecret = faker.string.alphanumeric(16);
  const newSecret = faker.string.alphanumeric(20);
  const plainName = faker.string.alpha(8);
  const buildData = (plainValue: string, secretValue: string) => ({
    [plainName]: plainValue,
    __insomnia_vault: { [secretName]: secretValue },
  });
  const id = faker.string.alphanumeric({ length: 16, casing: 'lower' });
  const seedFiles: Record<string, string> = {
    [fileName]: buildEnvironmentFile(environmentName, buildData('old', oldSecret), id),
  };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, fileName), buildEnvironmentFile(environmentName, buildData('new', newSecret), id));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  const tabs = await gitSyncPage.getEntityCardTabs('Base Environment');
  const variablesText = await gitSyncPage.getEntityCardText('Base Environment');
  await gitSyncPage.selectEntityCardTab('Base Environment', 'Secrets');
  const secretsText = await gitSyncPage.getEntityCardText('Base Environment');

  expect(tabs).toEqual(['Variables 1', 'Secrets 1']);
  expect(secretsText).toContain(secretName);
  expect(secretsText).toContain('••••••');
  for (const text of [variablesText, secretsText]) {
    expect(text).not.toContain(oldSecret);
    expect(text).not.toContain(newSecret);
  }
  expect(variablesText).not.toContain(secretName);
});
