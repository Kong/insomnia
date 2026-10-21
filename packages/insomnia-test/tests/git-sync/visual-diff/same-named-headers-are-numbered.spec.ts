import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, pushServerFile,test } from '../../../misc/git-fixtures';
import { Project } from '../../../models/project';

test('Verify same-named headers on a request card are told apart as (1) and (2)', async ({ user }) => {
  const { gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  const requestSettings = { renderRequestBody: true, encodeUrl: true, followRedirects: 'global', cookies: { send: true, store: true }, rebuildPath: true };
  const buildRequest = (id: string, name: string, url: string, extra: Record<string, unknown> = {}) => ({
    name,
    url,
    method: 'GET',
    meta: { id, created: 1000, modified: 1000, isPrivate: false },
    settings: requestSettings,
    ...extra,
  });
  const buildCollectionFile = (workspace: { id: string; name: string; environmentId: string }, collection: unknown[]) =>
    JSON.stringify(
      {
        type: 'collection.insomnia.rest/5.0',
        schema_version: '5.1',
        name: workspace.name,
        meta: { id: workspace.id, created: 1000, modified: 1000 },
        collection,
        environments: { name: 'Base Environment', meta: { id: workspace.environmentId, created: 1000, modified: 1000, isPrivate: false } },
      },
      null,
      2,
    );

  const workspace = { id: `wrk_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10), environmentId: `env_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}` };
  const request = { id: `req_${faker.string.alphanumeric({ length: 16, casing: 'lower' })}`, name: faker.string.alpha(10) };
  const headers = (defaultAgent: string, customAgent: string) => [
    { name: 'User-Agent', value: defaultAgent, disabled: true },
    { name: 'User-Agent', value: customAgent },
  ];
  const fileName = `${faker.string.alpha(10).toLowerCase()}.yaml`;
  const seedFiles: Record<string, string> = {
    [fileName]: buildCollectionFile(workspace, [
      buildRequest(request.id, request.name, 'https://example.com', { headers: headers('insomnia/12.1.0', '123') }),
    ]),
  };
  for (const [filePath, content] of Object.entries(seedFiles)) {
    await pushServerFile({ path: filePath, content });
  }
  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const cloneParentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insomnia-visual-diff-'));
  await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name, { cloneParentDir });
  const cloneDir = path.join(cloneParentDir, fs.readdirSync(cloneParentDir)[0]);
  fs.writeFileSync(path.join(cloneDir, fileName), buildCollectionFile(workspace, [
      buildRequest(request.id, request.name, 'https://example.com', { headers: headers('insomnia/12.2.0-beta', '4567') }),
    ]));
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  const tabs = await gitSyncPage.getEntityCardTabs(request.name);
  const cardText = await gitSyncPage.getEntityCardText(request.name);

  expect(tabs).toEqual(['Headers 2']);
  expect(cardText).toContain('User-Agent (1)');
  expect(cardText).toContain('User-Agent (2)');
});
