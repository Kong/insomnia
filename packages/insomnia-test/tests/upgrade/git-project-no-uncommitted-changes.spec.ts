import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { UpgradePhase } from '../../enums/upgrade-phase';
import { HTTP_SERVER } from '../../misc/fixtures';
import { expect, GIT_CREDENTIAL, test } from '../../misc/git-fixtures';
import type { UpgradeFixtures } from '../../misc/upgrade-fixture';
import { upgradeFixtures, upgradePhase } from '../../misc/upgrade-fixture';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

const projectName = 'upgrade-git-project';
const collectionName = 'upgrade-collection';
const requestName = 'upgrade-request';

const testWithUpgrade = test.extend<UpgradeFixtures>(upgradeFixtures);

testWithUpgrade.use({ appVersion: 'core@13.3.0' });

testWithUpgrade(
  'Create a collection and an HTTP request in a Git project',
  upgradePhase(UpgradePhase.Before),
  async ({ user }) => {
    const { preferencesFlow, workspaceFlow, httpRequestFlow, gitSyncFlow } = user.flowManager;

    await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
    const project = await workspaceFlow.create(new Project(projectName, ProjectType.Git), GIT_CREDENTIAL.name);
    const collection = await workspaceFlow.create(project, new Collection(collectionName));
    await httpRequestFlow.create(collection, {
      name: requestName,
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    });

    await gitSyncFlow.commit('Initial commit');
  },
);

testWithUpgrade(
  'Verify the work created before the upgrade cannot be committed',
  upgradePhase(UpgradePhase.After),
  async ({ user }) => {
    const { gitSyncPage, workspacePage } = user.pageManager;

    const projectNode = await workspacePage.findItemNode({ name: projectName });
    await workspacePage.clickNode(projectNode!);

    expect(await gitSyncPage.hasUncommittedChanges()).toBe(false);
  },
);
