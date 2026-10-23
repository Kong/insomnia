import { faker } from '@faker-js/faker';

import { GitChangeList } from '../../../enums/git-change-list';
import { GitDiffView } from '../../../enums/git-diff-view';
import { HttpMethod } from '../../../enums/http-method';
import { ProjectType } from '../../../enums/project-types';
import { HTTP_SERVER } from '../../../misc/fixtures';
import { DEFAULT_TIMEOUT, expect, GIT_CREDENTIAL,test } from '../../../misc/git-fixtures';
import { Collection } from '../../../models/collection';
import { HttpRequest } from '../../../models/http-request';
import { Project } from '../../../models/project';

test('Verify the diff pane defaults to Text, offers Visual (Beta), keeps the view across files and shows a request card header on one line', async ({ user }) => {
  const { gitSyncFlow, httpRequestFlow, preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage, httpRequestPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Git), GIT_CREDENTIAL.name);
  const baseName = faker.string.alpha(10).toLowerCase();
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), baseName);
  const fileName = `${baseName}.yaml`;

  const requests: HttpRequest[] = [];
  for (let i = 0; i < 1; i++) {
    requests.push(
      await httpRequestFlow.create(
        collection,
        new HttpRequest({ name: faker.string.alpha(10), url: `${HTTP_SERVER}/${faker.string.alphanumeric(10)}`, method: HttpMethod.Get }),
      ),
    );
  }
  await gitSyncFlow.commit(faker.string.alphanumeric(10));
  await httpRequestFlow.get(requests[0]);
  const longUrl = `${HTTP_SERVER}/${faker.string.alphanumeric(10)}/${faker.string.alphanumeric(120)}`;
  await httpRequestPage.setUrl(longUrl);
  const otherBaseName = faker.string.alpha(10).toLowerCase();
  await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), otherBaseName);
  await expect.poll(async () => gitSyncPage.hasUncommittedChanges(), { timeout: DEFAULT_TIMEOUT }).toBe(true);

  await gitSyncPage.openCommitDialog();
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, fileName);
  const defaultView = await gitSyncPage.getDiffView();
  const hasTextOption = await gitSyncPage.hasDiffViewOption(GitDiffView.Text);
  const hasVisualOption = await gitSyncPage.hasDiffViewOption(GitDiffView.Visual);
  await gitSyncPage.switchDiffView(GitDiffView.Visual);
  const header = await gitSyncPage.getEntityCardHeader(requests[0].name);
  const tabs = await gitSyncPage.getEntityCardTabs(requests[0].name);
  await gitSyncPage.openChangeDiff(GitChangeList.Unstaged, `${otherBaseName}.yaml`);
  const viewAfterSwitchingFile = await gitSyncPage.getDiffView();

  expect(defaultView).toBe(GitDiffView.Text);
  expect(hasTextOption).toBe(true);
  expect(hasVisualOption).toBe(true);
  expect(viewAfterSwitchingFile).toBe(GitDiffView.Visual);
  expect(header).toEqual({ badge: 'GET', name: requests[0].name, url: longUrl, onOneLine: true });
  expect(tabs).toEqual([]);
});
