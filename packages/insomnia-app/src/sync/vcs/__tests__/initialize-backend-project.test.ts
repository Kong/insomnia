import { createBuilder } from '@develohpanda/fluent-builder';

import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { snapshotStateEntrySchema } from '../../__schemas__/type-schemas';
import MemoryDriver from '../../store/drivers/memory-driver';
import { Snapshot } from '../../types';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from '../initialize-backend-project';
import { VCS } from '../vcs';

const snapshotStateBuilder = createBuilder(snapshotStateEntrySchema);

describe('initialize-backend-project', () => {
  beforeEach(globalBeforeEach);

  describe('initializeLocalBackendProjectAndMarkForSync()', () => {
    it('should do nothing if not request collection', async () => {
      // Arrange
      const workspace = await models.workspace.create({ scope: 'design' });
      await models.workspace.ensureChildren(workspace);
      const vcs = new VCS(new MemoryDriver());
      const switchAndCreateBackendProjectIfNotExistSpy = jest.spyOn(vcs, 'switchAndCreateBackendProjectIfNotExist');

      // Act
      await initializeLocalBackendProjectAndMarkForSync({ workspace, vcs });

      // Assert
      expect(switchAndCreateBackendProjectIfNotExistSpy).not.toHaveBeenCalled();
      const workspaceMeta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(workspaceMeta?.pushSnapshotOnInitialize).toBe(false);
      switchAndCreateBackendProjectIfNotExistSpy.mockClear();
    });
    it('should create a local project and commit', async () => {
      const workspace = await models.workspace.create();
      await models.workspace.ensureChildren(workspace);

      const environment = await models.environment.getByParentId(workspace._id);

      const vcs = new VCS(new MemoryDriver());

      await initializeLocalBackendProjectAndMarkForSync({ workspace, vcs });

      const historyCount = await vcs.getHistoryCount();
      expect(historyCount).toBe(1);
      const firstSnapshot = (await vcs.getHistory(1))[0];

      expect(firstSnapshot).toMatchObject<Partial<Snapshot>>({
        name: 'Initial Snapshot',
        parent: '0000000000000000000000000000000000000000',
        state: [
          snapshotStateBuilder
            .blob(expect.stringMatching(/.+/))
            .key(workspace._id)
            .name(workspace.name)
            .build(),
          snapshotStateBuilder
            .blob(expect.stringMatching(/.+/))
            .key(environment?._id || '')
            .name(environment?.name || '')
            .build(),
        ],
      });

      const workspaceMeta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(workspaceMeta?.pushSnapshotOnInitialize).toBe(true);
    });
  });

  describe('pushSnapshotOnInitialize()', () => {
    const vcs = new VCS(new MemoryDriver());

    const pushSpy = jest.spyOn(vcs, 'push');

    beforeEach(() => {
      jest.resetAllMocks();
    });

    afterAll(() => {
      pushSpy.mockClear();
    });

    it('should not push if no active project', async () => {
      const project = await models.project.create({ remoteId: null });
      const workspace = await models.workspace.create({ parentId: project._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id });
      vcs.clearBackendProject();

      await pushSnapshotOnInitialize({ vcs, project, workspace, workspaceMeta });

      expect(pushSpy).not.toHaveBeenCalled();
      await expect(models.workspaceMeta.getByParentId(workspace._id)).resolves.toStrictEqual(workspaceMeta);
    });

    it('should not push snapshot if not remote project', async () => {
      const project = await models.project.create({ remoteId: null });
      const workspace = await models.workspace.create({ parentId: project._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id });
      vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);

      await pushSnapshotOnInitialize({ vcs, project, workspace, workspaceMeta });

      expect(pushSpy).not.toHaveBeenCalled();
      await expect(models.workspaceMeta.getByParentId(workspace._id)).resolves.toStrictEqual(workspaceMeta);
    });

    it('should not push snapshot if workspace not in project', async () => {
      const project = await models.project.create({ remoteId: 'abc' });
      const anotherProject = await models.project.create({ remoteId: 'def' });
      const workspace = await models.workspace.create({ parentId: anotherProject._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id });
      vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);

      await pushSnapshotOnInitialize({ vcs, project, workspace, workspaceMeta });

      expect(pushSpy).not.toHaveBeenCalled();
      await expect(models.workspaceMeta.getByParentId(workspace._id)).resolves.toStrictEqual(workspaceMeta);
    });

    it('should not push snapshot if not marked for push', async () => {
      const project = await models.project.create({ remoteId: 'abc' });
      const workspace = await models.workspace.create({ parentId: project._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id, pushSnapshotOnInitialize: false });
      vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);

      await pushSnapshotOnInitialize({ vcs, project, workspace, workspaceMeta });

      expect(pushSpy).not.toHaveBeenCalled();
      await expect(models.workspaceMeta.getByParentId(workspace._id)).resolves.toStrictEqual(workspaceMeta);
    });

    it('should push snapshot if conditions are met', async () => {
      const project = await models.project.create({ remoteId: 'abc' });
      const workspace = await models.workspace.create({ parentId: project._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id, pushSnapshotOnInitialize: true });
      vcs.switchAndCreateBackendProjectIfNotExist(workspace._id, workspace.name);

      await pushSnapshotOnInitialize({ vcs, project, workspace, workspaceMeta });

      expect(pushSpy).toHaveBeenCalledWith(project.remoteId);
      const updatedMeta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(updatedMeta?.pushSnapshotOnInitialize).toBe(false);
    });
  });
});
