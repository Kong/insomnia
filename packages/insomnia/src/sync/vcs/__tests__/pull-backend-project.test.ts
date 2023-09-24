import { createBuilder } from '@develohpanda/fluent-builder';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mocked } from 'jest-mock';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { DEFAULT_BRANCH_NAME } from '../../../common/constants';
import * as models from '../../../models';
import { Workspace } from '../../../models/workspace';
import { backendProjectWithTeamSchema } from '../../__schemas__/type-schemas';
import MemoryDriver from '../../store/drivers/memory-driver';
import { pullBackendProject } from '../pull-backend-project';
import { VCS } from '../vcs';

jest.mock('../vcs');

const backendProject = createBuilder(backendProjectWithTeamSchema).build();

const newMockedVcs = () => mocked(new VCS(new MemoryDriver()), true);

describe('pullBackendProject()', () => {
  let vcs = newMockedVcs();

  beforeEach(async () => {
    (VCS as jest.MockedClass<typeof VCS>).mockClear();
    await globalBeforeEach();
    vcs = newMockedVcs();
  });

  afterEach(() => {
    expect(vcs.setBackendProject).toHaveBeenCalledWith(backendProject);
    expect(vcs.checkout).toHaveBeenCalledWith([], DEFAULT_BRANCH_NAME);
  });

  describe('creating a new project', () => {
    beforeEach(() => {
      vcs.getRemoteBranches.mockResolvedValue([]);
    });

    afterEach(() => {
      expect(vcs.pull).not.toHaveBeenCalledWith([], expect.anything());
    });

    it('should use existing project', async () => {
      // Arrange
      const project = await models.project.create({
        name: `${backendProject.team.name} unique`,
        remoteId: backendProject.team.id,
      });

      // Act
      await pullBackendProject({ vcs, backendProject, remoteProject: project });

      // Assert
      expect(project?.name).not.toBe(backendProject.team.name); // should not rename if the project already exists

      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      const expectedWorkspace: Partial<Workspace> = {
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: project._id,
        scope: 'collection',
      };

      expect(workspace).toEqual(expect.objectContaining(expectedWorkspace));
    });

    it('should insert a project and workspace with parent', async () => {
      const project = await models.project.create({
        name: `${backendProject.team.name} unique`,
        remoteId: backendProject.team.id,
      });
      // Act
      await pullBackendProject({ vcs, backendProject, remoteProject: project });

      // Assert
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      const expectedWorkspace: Partial<Workspace> = {
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: project?._id,
        scope: 'collection',
      };

      expect(workspace).toStrictEqual(expect.objectContaining(expectedWorkspace));
    });

    it('should update a workspace if the name or parentId is different', async () => {
      // Arrange
      await models.workspace.create({ _id: backendProject.rootDocumentId, name: 'someName' });
      const project = await models.project.create({
        name: `${backendProject.team.name} unique`,
        remoteId: backendProject.team.id,
      });
      // Act
      await pullBackendProject({ vcs, backendProject, remoteProject: project });

      // Assert

      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      const expectedWorkspace: Partial<Workspace> = {
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: project?._id,
      };

      expect(workspace).toStrictEqual(expect.objectContaining(expectedWorkspace));
    });
  });

  describe('pulling an existing project', () => {
    it('should overwrite the parentId only for a workspace with the project id', async () => {
      // Arrange
      vcs.getRemoteBranches.mockResolvedValue([DEFAULT_BRANCH_NAME]);
      const existingWrk = await models.workspace.create({ _id: backendProject.rootDocumentId, name: backendProject.name });
      const existingReq = await models.request.create({ parentId: existingWrk._id });

      vcs.allDocuments.mockResolvedValue([existingWrk, existingReq]);
      const project = await models.project.create({
        name: `${backendProject.team.name} unique`,
        remoteId: backendProject.team.id,
      });
      // Act
      await pullBackendProject({ vcs, backendProject, remoteProject: project });

      // Assert
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      const expectedWorkspace: Partial<Workspace> = {
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: project?._id,
      };

      expect(workspace).toStrictEqual(expect.objectContaining(expectedWorkspace));

      const requests = await models.request.all();
      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request).toStrictEqual(existingReq);

      expect(vcs.pull).toHaveBeenCalledWith({ candidates: [], teamId: project?.parentId, teamProjectId: project?._id });
    });
  });

  it('should throw the corrected intercepted error', async () => {
    // Arrange
    vcs.getRemoteBranches.mockRejectedValue(new Error('invalid access to project'));

    // Act
    const action = () => pullBackendProject({ vcs, backendProject, remoteProject: { remoteId: '' } });

    // Assert
    expect(vcs.pull).not.toHaveBeenCalled();
    await expect(action).rejects.toThrowError('You no longer have permission to pull the "name" collection.  Contact your team administrator if you think this is an error.');
  });
});
