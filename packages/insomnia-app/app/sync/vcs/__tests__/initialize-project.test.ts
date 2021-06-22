import { createBuilder } from '@develohpanda/fluent-builder';
import * as models from '../../../models';
import { globalBeforeEach } from '../../../__jest__/before-each';
import MemoryDriver from '../../store/drivers/memory-driver';
import { Snapshot } from '../../types';
import { snapshotStateEntrySchema } from '../../__schemas__/type-schemas';
import { initializeLocalProjectAndMarkForSync, pushSnapshotOnInitialize } from '../initialize-project';
import { VCS } from '../vcs';

const snapshotStateBuilder = createBuilder(snapshotStateEntrySchema);

describe('initialize-project', () => {
  beforeEach(globalBeforeEach);

  describe('initializeLocalProjectAndMarkForSync()', () => {
    it('should create a local project and commit', async () => {
      const workspace = await models.workspace.create();
      await models.workspace.ensureChildren(workspace);

      const environment = await models.environment.getByParentId(workspace._id);

      const vcs = new VCS(new MemoryDriver());

      await initializeLocalProjectAndMarkForSync({ workspace, vcs });

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

    it('should not push snapshot if not remote space', async () => {
      const space = await models.space.create({ remoteId: null });
      const workspace = await models.workspace.create({ parentId: space._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id });

      await pushSnapshotOnInitialize({ vcs, space, workspace, workspaceMeta });

      expect(pushSpy).not.toHaveBeenCalled();
      await expect(models.workspaceMeta.getByParentId(workspace._id)).resolves.toStrictEqual(workspaceMeta);
    });

    it('should not push snapshot if workspace not in space', async () => {
      const space = await models.space.create({ remoteId: 'abc' });
      const anotherSpace = await models.space.create({ remoteId: 'def' });
      const workspace = await models.workspace.create({ parentId: anotherSpace._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id });

      await pushSnapshotOnInitialize({ vcs, space, workspace, workspaceMeta });

      expect(pushSpy).not.toHaveBeenCalled();
      await expect(models.workspaceMeta.getByParentId(workspace._id)).resolves.toStrictEqual(workspaceMeta);
    });

    it('should not push snapshot if not marked for push', async () => {
      const space = await models.space.create({ remoteId: 'abc' });
      const workspace = await models.workspace.create({ parentId: space._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id, pushSnapshotOnInitialize: false });

      await pushSnapshotOnInitialize({ vcs, space, workspace, workspaceMeta });

      expect(pushSpy).not.toHaveBeenCalled();
      await expect(models.workspaceMeta.getByParentId(workspace._id)).resolves.toStrictEqual(workspaceMeta);
    });

    it('should push snapshot if conditions are met', async () => {
      const space = await models.space.create({ remoteId: 'abc' });
      const workspace = await models.workspace.create({ parentId: space._id });
      const workspaceMeta = await models.workspaceMeta.create({ parentId: workspace._id, pushSnapshotOnInitialize: true });

      await pushSnapshotOnInitialize({ vcs, space, workspace, workspaceMeta });

      expect(pushSpy).toHaveBeenCalledWith(space.remoteId);
      const updatedMeta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(updatedMeta?.pushSnapshotOnInitialize).toBe(false);
    });
  });
});
