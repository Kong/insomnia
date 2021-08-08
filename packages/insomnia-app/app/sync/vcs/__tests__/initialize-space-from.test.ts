import { createBuilder } from '@develohpanda/fluent-builder';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { isRemoteSpace, Space } from '../../../models/space';
import { isCollection, Workspace, WorkspaceScopeKeys } from '../../../models/workspace';
import { projectSchema, teamSchema } from '../../__schemas__/type-schemas';
import { initializeSpaceFromTeam, initializeWorkspaceFromProject } from '../initialize-model-from';

const teamBuilder = createBuilder(teamSchema);
const projectBuilder = createBuilder(projectSchema);

describe('initializeSpaceFromTeam', () => {
  beforeEach(globalBeforeEach);

  it('should initialize space with properties from the team', async () => {
    // Arrange
    const team = teamBuilder.build();

    // Act
    const space = await initializeSpaceFromTeam(team);

    // Assert
    expect(isRemoteSpace(space)).toBe(true);
    expect(space).toMatchObject<Partial<Space>>({
      _id:`${models.space.prefix}_${team.id}`,
      remoteId: team.id,
      name: team.name,
    });
  });
});

describe('initializeWorkspaceFromProject', () => {
  beforeEach(globalBeforeEach);

  it('should initialize workspac with properties from the project and space', async () => {
    // Arrange
    const space = await models.space.create();
    const project = projectBuilder.build();

    // Act
    const workspace = await initializeWorkspaceFromProject(project, space);

    // Assert
    expect(isCollection(workspace)).toBe(true);
    expect(workspace).toMatchObject<Partial<Workspace>>({
      _id: project.rootDocumentId,
      name: project.name,
      parentId: space._id,
      scope: WorkspaceScopeKeys.collection,
    });
  });
});
