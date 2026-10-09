import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import { expect, GIT_CREDENTIAL, test } from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test('Verify the Commit button needs a staged change and the commit form needs a message', async ({ user }) => {
  const { preferencesFlow, workspaceFlow } = user.flowManager;
  const { gitSyncPage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const fileName = faker.string.alpha(10).toLowerCase();
  await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)), fileName);

  await gitSyncPage.openCommitDialog();
  const disabledWithNothingStaged = await gitSyncPage.isCommitDisabled();
  await gitSyncPage.stageChange(`${fileName}.yaml`);
  const disabledWithStagedChange = await gitSyncPage.isCommitDisabled();
  await gitSyncPage.commitStaged();
  const dialogOpenAfterEmptySubmit = await gitSyncPage.isCommitDialogOpen();
  const stagedAfterEmptySubmit = await gitSyncPage.getStagedChanges();

  expect(disabledWithNothingStaged).toBe(true);
  expect(disabledWithStagedChange).toBe(false);
  expect(dialogOpenAfterEmptySubmit).toBe(true);
  expect(stagedAfterEmptySubmit).toEqual([`${fileName}.yaml`]);
});
