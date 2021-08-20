import { createBuilder } from '@develohpanda/fluent-builder';
import { mocked } from 'ts-jest/utils';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { DEFAULT_BRANCH_NAME } from '../../../common/constants';
import * as models from '../../../models';
import { isRemoteProject } from '../../../models/project';
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
      await pullBackendProject({ vcs, backendProject, remoteProjects: [project].filter(isRemoteProject) });

      // Assert
      expect(project?.name).not.toBe(backendProject.team.name); // should not rename if the project already exists

      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: project._id,
        scope: 'collection',
      }));
    });

    it('should insert a project and workspace with parent', async () => {
      // Act
      await pullBackendProject({ vcs, backendProject, remoteProjects: [] });

      // Assert
      const project = await models.project.getByRemoteId(backendProject.team.id);
      expect(project?.name).toBe(backendProject.team.name);

      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: project?._id,
        scope: 'collection',
      }));
    });

    it('should update a workspace if the name or parentId is different', async () => {
      // Arrange
      await models.workspace.create({ _id: backendProject.rootDocumentId, name: 'someName' });

      // Act
      await pullBackendProject({ vcs, backendProject, remoteProjects: [] });

      // Assert
      const project = await models.project.getByRemoteId(backendProject.team.id);

      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: project?._id,
      }));
    });
  });

  describe('pulling an existing project', () => {
    it('should overwrite the parentId only for a workspace with the project id', async () => {
      // Arrange
      vcs.getRemoteBranches.mockResolvedValue([DEFAULT_BRANCH_NAME]);
      const existingWrk = await models.workspace.create({ _id: backendProject.rootDocumentId, name: backendProject.name });
      const existingReq = await models.request.create({ parentId: existingWrk._id });

      vcs.allDocuments.mockResolvedValue([existingWrk, existingReq]);

      // Act
      await pullBackendProject({ vcs, backendProject, remoteProjects: [] });

      // Assert
      const project = await models.project.getByRemoteId(backendProject.team.id);

      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: backendProject.rootDocumentId,
        name: backendProject.name,
        parentId: project?._id,
      }));

      const requests = await models.request.all();
      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request).toStrictEqual(existingReq);

      expect(vcs.pull).toHaveBeenCalledWith([], project?.remoteId);
    });
  });

  it('should throw the corrected intercepted error', async () => {
    // Arrange
    vcs.getRemoteBranches.mockRejectedValue(new Error('invalid access to project'));

    // Act
    const action = () => pullBackendProject({ vcs, backendProject, remoteProjects: [] });

    // Assert
    expect(vcs.pull).not.toHaveBeenCalled();
    await expect(action).rejects.toThrowError('You no longer have permission to pull the "name" collection.  Contact your team administrator if you think this is an error.');
  });
});
