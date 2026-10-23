import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify discarding one request from the Visual (Beta) view needs a confirmation click, can be ignored, and keeps the other edits', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;

  const requests: HttpRequest[] = [];
  for (let i = 0; i < 2; i++) {
    requests.push(
      await httpRequestFlow.create(
        collection,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const editedUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
  await httpRequestFlow.get(requests[0]);
  await httpRequestPage.setUrl(`${HTTP_SERVER}/${faker.string.alphanumeric(10)}`);
  await httpRequestFlow.get(requests[1]);
  await httpRequestPage.setUrl(editedUrl);
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
  await gitSyncPage.startEntityDiscard(requests[1].name);
  await gitSyncPage.waitForEntityDiscardPromptToLapse(requests[1].name);
  const ignoredCardVisible = await gitSyncPage.isEntityCardVisible(requests[1].name);
  const ignoredActions = await gitSyncPage.getEntityCardActions(requests[1].name);
  const actionsBefore = await gitSyncPage.getEntityCardActions(requests[0].name);
  await gitSyncPage.startEntityDiscard(requests[0].name);
  const confirmLabel = await gitSyncPage.getEntityDiscardConfirmLabel(requests[0].name);
  await gitSyncPage.confirmEntityDiscard(requests[0].name);
  const remainingCards = await gitSyncPage.getEntityCardNames();
  await gitSyncPage.closeCommitDialog();
  const discardedRequest = await httpRequestFlow.get(requests[0]);
  const keptRequest = await httpRequestFlow.get(requests[1]);

  expect(ignoredCardVisible).toBe(true);
  expect(ignoredActions).toEqual(['Discard', 'Stage']);
  expect(actionsBefore).toEqual(['Discard', 'Stage']);
  expect(confirmLabel).toBe('Confirm');
  expect(remainingCards).toEqual([requests[1].name]);
  expect(discardedRequest?.url).toBe(requests[0].url);
  expect(keptRequest?.url).toBe(editedUrl);
});
