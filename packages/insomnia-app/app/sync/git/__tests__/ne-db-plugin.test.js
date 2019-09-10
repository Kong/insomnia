import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { assertAsyncError, setupDateMocks } from './util';
import NeDBPlugin from '../ne-db-plugin';

describe('NeDBPlugin', () => {
  beforeEach(async () => {
    await globalBeforeEach();

    setupDateMocks();

    // Create some sample models
    await models.workspace.create({ _id: 'wrk_1' });
    await models.request.create({ _id: 'req_1', parentId: 'wrk_1' });
    await models.request.create({ _id: 'req_2', parentId: 'wrk_1' });

    // Shouldn't list private docs
    await models.request.create({ id: 'req_x', isPrivate: true, parentId: 'wrk_1' });
  });

  describe('readdir()', () => {
    it('reads model IDs from model type folders', async () => {
      const pNeDB = new NeDBPlugin('wrk_1');

      expect(await pNeDB.readdir('/')).toEqual([
        'ApiSpec',
        'Environment',
        'Request',
        'RequestGroup',
        'Workspace',
      ]);
      expect(await pNeDB.readdir('/Request')).toEqual(['req_1.json', 'req_2.json']);
      expect(await pNeDB.readdir('/Workspace')).toEqual(['wrk_1.json']);
    });
  });

  describe('readFile()', () => {
    it('reads file from model/id folders', async () => {
      const pNeDB = new NeDBPlugin('wrk_1');

      expect(JSON.parse(await pNeDB.readFile('/Workspace/wrk_1.json'))).toEqual(
        expect.objectContaining({ _id: 'wrk_1', parentId: null }),
      );

      expect(JSON.parse(await pNeDB.readFile('/Request/req_1.json'))).toEqual(
        expect.objectContaining({ _id: 'req_1', parentId: 'wrk_1' }),
      );

      await assertAsyncError(pNeDB.readFile('/Request/req_x.json'));
    });
  });

  describe('stat()', () => {
    it('stats a dir', async () => {
      const pNeDB = new NeDBPlugin('wrk_1');

      expect(await pNeDB.stat('/')).toEqual(expect.objectContaining({ type: 'dir' }));
      expect(await pNeDB.stat('/Workspace/wrk_1.json')).toEqual(
        expect.objectContaining({ type: 'file' }),
      );
      expect(await pNeDB.stat('/Request')).toEqual(expect.objectContaining({ type: 'dir' }));
      expect(await pNeDB.stat('/Request/req_2.json')).toEqual(
        expect.objectContaining({ type: 'file' }),
      );
    });
  });
});
