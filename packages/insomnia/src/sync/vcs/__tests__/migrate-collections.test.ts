import { createBuilder } from '@develohpanda/fluent-builder';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mocked } from 'jest-mock';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { isLoggedIn as _isLoggedIn } from '../../../account/session';
import * as models from '../../../models';
import { backendProjectWithTeamSchema, teamSchema } from '../../__schemas__/type-schemas';
import MemoryDriver from '../../store/drivers/memory-driver';
import { migrateCollectionsIntoRemoteProject } from '../migrate-collections';
import { VCS } from '../vcs';

jest.mock('../vcs');
jest.mock('../../../account/session', () => ({
  isLoggedIn: jest.fn(),
}));

const isLoggedIn = mocked(_isLoggedIn);
const newMockedVcs = () => mocked(new VCS(new MemoryDriver()), true);

const projectWithTeamBuilder = createBuilder(backendProjectWithTeamSchema);
const teamBuilder = createBuilder(teamSchema);

describe('migrateCollectionsIntoRemoteProject', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    // Always return logged in
    isLoggedIn.mockReturnValue(true);
    teamBuilder.reset();
    projectWithTeamBuilder.reset();
  });

  it('exits if not logged in', async () => {
    // Arrange
    isLoggedIn.mockReturnValue(false);
    const vcs = newMockedVcs();

    // Act
    await migrateCollectionsIntoRemoteProject(vcs);

    // Assert
    expect(vcs.hasBackendProjectForRootDocument).not.toHaveBeenCalled();
    expect(vcs.remoteBackendProjectsInAnyTeam).not.toHaveBeenCalled();
  });

  it('does not migrate if all collections are in a remote project already', async () => {
    // Arrange
    const vcs = newMockedVcs();

    const remoteProject = await models.project.create({ remoteId: 'str' });
    const workspaceInRemote = await models.workspace.create({ parentId: remoteProject._id });

    vcs.hasBackendProjectForRootDocument.mockResolvedValue(true); // has local backend project

    // Act
    await migrateCollectionsIntoRemoteProject(vcs);

    // Assert
    expect(vcs.remoteBackendProjectsInAnyTeam).not.toHaveBeenCalled();
    await expect(models.workspace.getById(workspaceInRemote._id)).resolves.toStrictEqual(workspaceInRemote);
  });

  it('does not migrate if design documents', async () => {
    // Arrange
    const vcs = newMockedVcs();

    const localProject = await models.project.create();
    const workspaceInLocal = await models.workspace.create({ scope: 'design', parentId: localProject._id });

    vcs.hasBackendProjectForRootDocument.mockResolvedValue(true); // has local backend project

    // Act
    await migrateCollectionsIntoRemoteProject(vcs);

    // Assert
    expect(vcs.remoteBackendProjectsInAnyTeam).not.toHaveBeenCalled();
    await expect(models.workspace.getById(workspaceInLocal._id)).resolves.toStrictEqual(workspaceInLocal);
  });
});
