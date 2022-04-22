import { createBuilder } from '@develohpanda/fluent-builder';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { isRemoteProject, Project } from '../../../models/project';
import { isCollection, Workspace, WorkspaceScopeKeys } from '../../../models/workspace';
import { projectSchema, teamSchema } from '../../__schemas__/type-schemas';
import { initializeProjectFromTeam, initializeWorkspaceFromBackendProject } from '../initialize-model-from';

const teamBuilder = createBuilder(teamSchema);
const backendProjectBuilder = createBuilder(projectSchema);

describe('initializeProjectFromTeam', () => {
  beforeEach(globalBeforeEach);

  it('should initialize project with properties from the team', async () => {
    // Arrange
    const team = teamBuilder.build();

    // Act
    const project = await initializeProjectFromTeam(team);

    // Assert
    expect(isRemoteProject(project)).toBe(true);
    expect(project).toMatchObject<Partial<Project>>({
      _id:`${models.project.prefix}_${team.id}`,
      remoteId: team.id,
      name: team.name,
    });
  });
});

describe('initializeWorkspaceFromProject', () => {
  beforeEach(globalBeforeEach);

  it('should initialize workspac with properties from the backendProject and project', async () => {
    // Arrange
    const project = await models.project.create();
    const backendProject = backendProjectBuilder.build();

    // Act
    const workspace = await initializeWorkspaceFromBackendProject(backendProject, project);

    // Assert
    expect(isCollection(workspace)).toBe(true);
    expect(workspace).toMatchObject<Partial<Workspace>>({
      _id: backendProject.rootDocumentId,
      name: backendProject.name,
      parentId: project._id,
      scope: WorkspaceScopeKeys.collection,
    });
  });
});
