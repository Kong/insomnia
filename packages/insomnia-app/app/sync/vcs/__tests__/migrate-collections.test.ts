import { createBuilder } from '@develohpanda/fluent-builder';
import { mocked } from 'ts-jest/utils';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { isLoggedIn as _isLoggedIn } from '../../../account/session';
import { database } from '../../../common/database';
import * as models from '../../../models';
import { BASE_PROJECT_ID } from '../../../models/project';
import { backendProjectWithTeamSchema, teamSchema } from '../../__schemas__/type-schemas';
import MemoryDriver from '../../store/drivers/memory-driver';
import { initializeSpaceFromTeam } from '../initialize-model-from';
import { migrateCollectionsIntoRemoteSpace } from '../migrate-collections';
import { VCS } from '../vcs';

jest.mock('../vcs');
jest.mock('../../../account/session', () => ({
  isLoggedIn: jest.fn(),
}));

const isLoggedIn = mocked(_isLoggedIn);
const newMockedVcs = () => mocked(new VCS(new MemoryDriver()), true);

const projectWithTeamBuilder = createBuilder(backendProjectWithTeamSchema);
const teamBuilder = createBuilder(teamSchema);

describe('migrateCollectionsIntoRemoteSpace', () => {
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
    await migrateCollectionsIntoRemoteSpace(vcs);

    // Assert
    expect(vcs.hasBackendProjectForRootDocument).not.toHaveBeenCalled();
    expect(vcs.remoteBackendProjectsInAnyTeam).not.toHaveBeenCalled();
  });

  it('does not migrate if collection is in non-remote space but no local backend project exists', async () => {
    // Arrange
    const vcs = newMockedVcs();

    const baseSpace = await models.space.getById(BASE_PROJECT_ID);
    const workspaceInBase = await models.workspace.create({ parentId: baseSpace?._id });

    const localSpace = await models.space.create();
    const workspaceInLocal = await models.workspace.create({ parentId: localSpace._id });

    vcs.hasBackendProjectForRootDocument.mockResolvedValue(false); // no local backend project

    // Act
    await migrateCollectionsIntoRemoteSpace(vcs);

    // Assert
    expect(vcs.remoteBackendProjectsInAnyTeam).not.toHaveBeenCalled();
    await expect(models.workspace.getById(workspaceInBase._id)).resolves.toStrictEqual(workspaceInBase);
    await expect(models.workspace.getById(workspaceInLocal._id)).resolves.toStrictEqual(workspaceInLocal);
  });

  it('does not migrate if all collections are in a remote space already', async () => {
    // Arrange
    const vcs = newMockedVcs();

    const remoteSpace = await models.space.create({ remoteId: 'str' });
    const workspaceInRemote = await models.workspace.create({ parentId: remoteSpace._id });

    vcs.hasBackendProjectForRootDocument.mockResolvedValue(true); // has local backend project

    // Act
    await migrateCollectionsIntoRemoteSpace(vcs);

    // Assert
    expect(vcs.remoteBackendProjectsInAnyTeam).not.toHaveBeenCalled();
    await expect(models.workspace.getById(workspaceInRemote._id)).resolves.toStrictEqual(workspaceInRemote);
  });

  it('does not migrate if design documents', async () => {
    // Arrange
    const vcs = newMockedVcs();

    const localSpace = await models.space.create();
    const workspaceInLocal = await models.workspace.create({ scope: 'design', parentId: localSpace._id });

    vcs.hasBackendProjectForRootDocument.mockResolvedValue(true); // has local backend project

    // Act
    await migrateCollectionsIntoRemoteSpace(vcs);

    // Assert
    expect(vcs.remoteBackendProjectsInAnyTeam).not.toHaveBeenCalled();
    await expect(models.workspace.getById(workspaceInLocal._id)).resolves.toStrictEqual(workspaceInLocal);
  });

  it('does migrate if collection in non-remote space with local backend project - create remote space', async () => {
    // Arrange
    const vcs = newMockedVcs();
    const localSpace = await models.space.create();
    const workspaceInLocal = await models.workspace.create({ parentId: localSpace._id });

    const team = teamBuilder.build();
    const remoteBackendProjectWithTeam = projectWithTeamBuilder
      .rootDocumentId(workspaceInLocal._id)
      .team(team)
      .build();

    vcs.hasBackendProjectForRootDocument.mockResolvedValue(true); // has local backend project
    vcs.remoteBackendProjectsInAnyTeam.mockResolvedValue([remoteBackendProjectWithTeam]); // has local backend project

    // Act
    await migrateCollectionsIntoRemoteSpace(vcs);

    // Assert
    expect(vcs.remoteBackendProjectsInAnyTeam).toHaveBeenCalledTimes(1);
    const createdRemoteSpace = await models.space.getByRemoteId(team.id);
    await expect(models.workspace.getById(workspaceInLocal._id)).resolves.toMatchObject({
      ...workspaceInLocal,
      parentId: createdRemoteSpace?._id,
    });
  });

  it('does migrate if collection in non-remote space with local backend project - use existing remote space', async () => {
    // Arrange
    const vcs = newMockedVcs();
    const localSpace = await models.space.create();
    const workspaceInLocal = await models.workspace.create({ parentId: localSpace._id });

    const team = teamBuilder.build();
    const existingRemoteSpace = await initializeSpaceFromTeam(team);
    await database.batchModifyDocs({ upsert: [existingRemoteSpace] });

    const remoteProjectWithTeam = projectWithTeamBuilder
      .rootDocumentId(workspaceInLocal._id)
      .team(team)
      .build();

    vcs.hasBackendProjectForRootDocument.mockResolvedValue(true); // has local backend project
    vcs.remoteBackendProjectsInAnyTeam.mockResolvedValue([remoteProjectWithTeam]); // has local backend project

    // Act
    await migrateCollectionsIntoRemoteSpace(vcs);

    // Assert
    expect(vcs.remoteBackendProjectsInAnyTeam).toHaveBeenCalledTimes(1);
    await expect(models.workspace.getById(workspaceInLocal._id)).resolves.toMatchObject({
      ...workspaceInLocal,
      parentId: existingRemoteSpace?._id,
    });
  });
});
