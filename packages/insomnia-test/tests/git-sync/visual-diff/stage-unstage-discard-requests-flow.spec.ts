import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL, test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify staging, unstaging and discarding individual requests from the Visual (Beta) view keeps the Staged and Unstaged lists consistent, ignores clicks during a pending action and never lets two actions overwrite each other', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;
  const requests: HttpRequest[] = [];
  for (let i = 0; i < 6; i++) {
    requests.push(
      await httpRequestFlow.create(
        collection,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  const [ignored, discarded, burst1, burst2, burst3, discardedLater] = [requests[0], requests[1], requests[2], requests[3], requests[4], requests[5]];
  // `ignored` keeps its edit through the lapsed discard and becomes the first staged request
  const editedUrls = new Map<string, string>();
  for (const request of requests) {
    const editedUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`;
    editedUrls.set(request.name, editedUrl);
    await httpRequestFlow.get(request);
    await httpRequestPage.setUrl(editedUrl);
  }
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);

  const ignoredDiscard = await test.step('Discard needs a confirmation click and a lapsed prompt changes nothing', async () => {
    await gitSyncPage.startEntityDiscard(ignored.name);
    await gitSyncPage.waitForEntityDiscardPromptToLapse(ignored.name);
    return {
      cardVisible: await gitSyncPage.isEntityCardVisible(ignored.name),
      actions: await gitSyncPage.getEntityCardActions(ignored.name),
    };
  });

  const confirmedDiscard = await test.step('Confirming the discard of one request keeps the other edits', async () => {
    await gitSyncPage.startEntityDiscard(discarded.name);
    const confirmLabel = await gitSyncPage.getEntityDiscardConfirmLabel(discarded.name);
    await gitSyncPage.confirmEntityDiscard(discarded.name);
    const remainingCards = await gitSyncPage.getEntityCardNames();
    await gitSyncPage.closeCommitDialog();
    return {
      confirmLabel,
      remainingCards,
      discardedUrl: (await httpRequestFlow.get(discarded))?.url,
      keptUrl: (await httpRequestFlow.get(ignored))?.url,
    };
  });

  const afterFirstStage = await test.step('Staging one request leaves the others unstaged and each side offers the right actions', async () => {
    await gitSyncFlow.stageEntity(fileName, ignored.name);
    const unstagedCards = await gitSyncPage.getEntityCardNames();
    const unstagedActions = await gitSyncPage.getEntityCardActions(burst1.name);
    const files = { staged: await gitSyncPage.getStagedChanges(), unstaged: await gitSyncPage.getUnstagedChanges() };
    await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
    return {
      unstagedCards,
      unstagedActions,
      files,
      stagedCards: await gitSyncPage.getEntityCardNames(),
      stagedActions: await gitSyncPage.getEntityCardActions(ignored.name),
    };
  });

  const afterBurst = await test.step('Clicks made while an action is pending are ignored', async () => {
    await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
    await gitSyncPage.stageEntitiesInQuickSuccession([burst1.name, burst2.name, burst3.name]);
    const unstagedCards = await gitSyncPage.getEntityCardNames();
    await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
    return { unstagedCards, stagedCards: await gitSyncPage.getEntityCardNames() };
  });

  const afterUnstageAndDiscard = await test.step('Unstaging and discarding keep both lists consistent', async () => {
    await gitSyncFlow.unstageEntity(fileName, ignored.name);
    const stagedCards = await gitSyncPage.getEntityCardNames();
    await gitSyncFlow.discardEntity(fileName, discardedLater.name);
    return { stagedCards, unstagedCards: await gitSyncPage.getEntityCardNames() };
  });

  await test.step('Stage this file clicked while an entity action is pending overwrites neither action', async () => {
    await gitSyncFlow.openVisualDiff(GitChangeList.Unstaged, fileName);
    await gitSyncPage.stageEntityThenFileInQuickSuccession(burst2.name);
    await expect.poll(async () => gitSyncPage.getUnstagedChanges(), { timeout: DEFAULT_TIMEOUT }).toEqual([]);
  });

  const stagedFiles = await gitSyncPage.getStagedChanges();
  await gitSyncFlow.openVisualDiff(GitChangeList.Staged, fileName);
  const finalStagedCards = await gitSyncPage.getEntityCardNames();

  expect(ignoredDiscard).toEqual({ cardVisible: true, actions: ['Discard', 'Stage'] });
  expect(confirmedDiscard.confirmLabel).toBe('Confirm');
  expect(confirmedDiscard.remainingCards.sort()).toEqual([ignored, burst1, burst2, burst3, discardedLater].map(request => request.name).sort());
  expect(confirmedDiscard.discardedUrl).toBe(discarded.url);
  expect(confirmedDiscard.keptUrl).toBe(editedUrls.get(ignored.name));
  expect(afterFirstStage.unstagedCards.sort()).toEqual([burst1, burst2, burst3, discardedLater].map(request => request.name).sort());
  expect(afterFirstStage.unstagedActions).toEqual(['Discard', 'Stage']);
  expect(afterFirstStage.files).toEqual({ staged: [fileName], unstaged: [fileName] });
  expect(afterFirstStage.stagedCards).toEqual([ignored.name]);
  expect(afterFirstStage.stagedActions).toEqual(['Unstage']);
  expect(afterBurst.unstagedCards.sort()).toEqual([burst2, burst3, discardedLater].map(request => request.name).sort());
  expect(afterBurst.stagedCards.sort()).toEqual([ignored, burst1].map(request => request.name).sort());
  expect(afterUnstageAndDiscard.stagedCards).toEqual([burst1.name]);
  expect(afterUnstageAndDiscard.unstagedCards.sort()).toEqual([ignored, burst2, burst3].map(request => request.name).sort());
  expect(stagedFiles).toEqual([fileName]);
  expect(finalStagedCards.sort()).toEqual([ignored, burst1, burst2, burst3].map(request => request.name).sort());
});
