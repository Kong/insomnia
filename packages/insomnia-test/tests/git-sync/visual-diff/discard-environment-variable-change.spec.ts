import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { ProjectType } from '../../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { ENVIRONMENT_TYPE, EnvironmentKvPairDataType } from '../../../models/environment';
import { Project } from '../../../models/project';

test('Verify discarding an environment card reverts its variable changes and leaves other environments alone', async ({ user }) => {
  const { cookieFlow, environmentFlow, gitSyncFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { cookiePage, environmentPage, gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const collectionBaseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), collectionBaseName);
  const baseName = faker.string.alpha(10);
  const subName = faker.string.alpha(10);
  const variable = (name: string, value: string) => ({ id: '', name, value, type: EnvironmentKvPairDataType.STRING });
  const keptName = faker.string.alpha(8);
  const changedName = faker.string.alpha(8);
  const removedName = faker.string.alpha(8);
  const originalVariables = [variable(keptName, 'kept'), variable(changedName, 'old'), variable(removedName, 'removed')];
  const baseEnvironment = await environmentFlow.create(project, {
    name: baseName,
    type: ENVIRONMENT_TYPE,
    kvPairData: originalVariables,
  });
  await environmentFlow.create(baseEnvironment, {
    name: subName,
    type: ENVIRONMENT_TYPE,
    kvPairData: [variable('subVar', 'old')],
  });
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  await environmentPage.selectEnvironment(baseName);
  await environmentPage.setVariables([
    variable(keptName, 'kept'),
    variable(changedName, 'new'),
    variable(faker.string.alpha(8), 'added'),
  ]);
  await environmentPage.selectEnvironment(subName);
  await environmentPage.setVariables([variable('subVar', 'new')]);
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  const fileName = `${baseName.toLowerCase()}.yaml`;
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  const cardsBefore = await gitSyncPage.getEntityCardNames();
  const baseActions = await gitSyncPage.getEntityCardActions(baseName);
  await gitSyncFlow.discardEntity(fileName, baseName);
  const cardsAfter = await gitSyncPage.getEntityCardNames();
  await gitSyncPage.closeCommitDialog();
  await environmentPage.selectEnvironment(baseName);
  const baseJson = await environmentPage.getRawJson();
  await environmentPage.selectEnvironment(subName);
  const subJson = await environmentPage.getRawJson();

  const changedCookieKey = faker.string.alpha(8);
  await cookieFlow.link(collection, [{ key: changedCookieKey, value: 'changed', domain: 'localhost', path: '/' }]);
  const collectionFileName = `${collectionBaseName}.yaml`;
  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, collectionFileName);
  const jarActions = await gitSyncPage.getEntityCardActions('Default Jar');
  await gitSyncFlow.discardEntity(collectionFileName, 'Default Jar');
  await expect.poll(async () => gitSyncPage.getUnstagedChanges(), { timeout: DEFAULT_TIMEOUT }).not.toContain(collectionFileName);
  await gitSyncPage.closeCommitDialog();
  await cookiePage.open();
  const cookiesAfter = await cookiePage.getCookies();
  await cookiePage.close();

  expect(cardsBefore.sort()).toEqual([baseName, subName].sort());
  expect(baseActions).toEqual(['Discard', 'Stage']);
  expect(jarActions).toEqual(['Discard', 'Stage']);
  expect(cookiesAfter.map(cookie => cookie.key)).not.toContain(changedCookieKey);
  expect(cardsAfter).toEqual([subName]);
  expect(JSON.parse(baseJson)).toEqual({ [keptName]: 'kept', [changedName]: 'old', [removedName]: 'removed' });
  expect(JSON.parse(subJson)).toEqual({ subVar: 'new' });
});
