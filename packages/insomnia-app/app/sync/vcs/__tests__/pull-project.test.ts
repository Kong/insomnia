import { createBuilder } from '@develohpanda/fluent-builder';
import VCS from '../';
import { DEFAULT_BRANCH_NAME } from '../../../common/constants';
import * as models from '../../../models';
import { Workspace } from '../../../models/workspace';
import { globalBeforeEach } from '../../../__jest__/before-each';
import { projectSchema } from '../../__schemas__/type-schemas';
import { pullProject } from '../pull-project';
import { mocked } from 'ts-jest/utils';
import MemoryDriver from '../../store/drivers/memory-driver';

jest.mock('../');

const project = createBuilder(projectSchema).build();

const newMockedVcs = () => mocked(new VCS(new MemoryDriver()), true);

describe('pullProject()', () => {
  let vcs = newMockedVcs();

  beforeEach(async () => {
    (VCS as jest.MockedClass<typeof VCS>).mockClear();
    await globalBeforeEach();
    vcs = newMockedVcs();
  });

  afterEach(() => {
    expect(vcs.setProject).toHaveBeenCalledWith(project);
    expect(vcs.checkout).toHaveBeenCalledWith([], DEFAULT_BRANCH_NAME);
  });

  describe('creating a new project', () => {
    beforeEach(() => {
      vcs.getRemoteBranches.mockResolvedValue([]);
    });

    afterEach(() => {
      expect(vcs.pull).not.toHaveBeenCalledWith([]);
    });

    it('should insert a workspace with no parent', async () => {
      // Arrange
      const spaceId = undefined;

      // Act
      await pullProject({ vcs, project, spaceId });

      // Assert
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: project.rootDocumentId,
        name: project.name,
        // @ts-expect-error parent id is optional for workspaces
        parentId: null,
      }));
    });

    it('should insert a workspace with parent', async () => {
      // Arrange
      const spaceId = 'spaceId';

      // Act
      await pullProject({ vcs, project, spaceId });

      // Assert
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: project.rootDocumentId,
        name: project.name,
        parentId: spaceId,
      }));
    });

    it('should update a workspace if the name or parentId is different', async () => {
      // Arrange
      await models.workspace.create({ _id: project.rootDocumentId, name: 'someName' });
      const spaceId = 'spaceId';

      // Act
      await pullProject({ vcs, project, spaceId });

      // Assert
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: project.rootDocumentId,
        name: project.name,
        parentId: spaceId,
      }));
    });
  });

  describe('pulling an existing project', () => {
    beforeEach(() => {
      vcs.getRemoteBranches.mockResolvedValue([DEFAULT_BRANCH_NAME]);
    });

    afterEach(() => {
      expect(vcs.pull).toHaveBeenCalledWith([]);
    });

    it('should overwrite the parentId only for a workspace with null', async () => {
      // Arrange
      const spaceId = undefined;
      const existingWrk = await models.workspace.create({ _id: project.rootDocumentId, name: project.name });
      const existingReq = await models.request.create({ parentId: existingWrk._id });

      vcs.allDocuments.mockResolvedValue([existingWrk, existingReq]);

      // Act
      await pullProject({ vcs, project, spaceId });

      // Assert
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: project.rootDocumentId,
        name: project.name,
        // @ts-expect-error parent id is optional for workspaces
        parentId: null,
      }));

      const requests = await models.request.all();
      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request).toStrictEqual(existingReq);
    });

    it('should overwrite the parentId only for a workspace with the space id', async () => {
      // Arrange
      const spaceId = 'spaceId';
      const existingWrk = await models.workspace.create({ _id: project.rootDocumentId, name: project.name });
      const existingReq = await models.request.create({ parentId: existingWrk._id });

      vcs.allDocuments.mockResolvedValue([existingWrk, existingReq]);

      // Act
      await pullProject({ vcs, project, spaceId });

      // Assert
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace).toStrictEqual(expect.objectContaining<Partial<Workspace>>({
        _id: project.rootDocumentId,
        name: project.name,
        parentId: spaceId,
      }));

      const requests = await models.request.all();
      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request).toStrictEqual(existingReq);
    });
  });
});
