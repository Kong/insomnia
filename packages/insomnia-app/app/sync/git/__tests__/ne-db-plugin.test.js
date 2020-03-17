import YAML from 'yaml';
import { globalBeforeEach } from '../../../__jest__/before-each';
import * as models from '../../../models';
import { assertAsyncError, setupDateMocks } from './util';
import NeDBPlugin from '../ne-db-plugin';
import { GIT_NAMESPACE_DIR } from '../git-vcs';

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

      expect(await pNeDB.readdir('/')).toEqual([GIT_NAMESPACE_DIR]);
      expect(await pNeDB.readdir(`/${GIT_NAMESPACE_DIR}`)).toEqual([
        'ApiSpec',
        'Environment',
        'Request',
        'RequestGroup',
        'Workspace',
      ]);
      expect(await pNeDB.readdir(`/${GIT_NAMESPACE_DIR}/Request`)).toEqual(['req_1.yml', 'req_2.yml']);
      expect(await pNeDB.readdir(`/${GIT_NAMESPACE_DIR}/Workspace`)).toEqual(['wrk_1.yml']);
    });
  });

  describe('readFile()', () => {
    it('reads file from model/id folders', async () => {
      const pNeDB = new NeDBPlugin('wrk_1');

      expect(YAML.parse(await pNeDB.readFile(`/${GIT_NAMESPACE_DIR}/Workspace/wrk_1.yml`, 'utf8'))).toEqual(
        expect.objectContaining({ _id: 'wrk_1', parentId: null }),
      );

      expect(YAML.parse(await pNeDB.readFile(`/${GIT_NAMESPACE_DIR}/Request/req_1.yml`, 'utf8'))).toEqual(
        expect.objectContaining({ _id: 'req_1', parentId: 'wrk_1' }),
      );

      await assertAsyncError(pNeDB.readFile(`/${GIT_NAMESPACE_DIR}/Request/req_x.yml`));
    });
  });

  describe('stat()', () => {
    it('stats a dir', async () => {
      const pNeDB = new NeDBPlugin('wrk_1');

      expect(await pNeDB.stat('/')).toEqual(expect.objectContaining({ type: 'dir' }));
      expect(await pNeDB.stat(`/${GIT_NAMESPACE_DIR}`)).toEqual(expect.objectContaining({ type: 'dir' }));
      expect(await pNeDB.stat(`/${GIT_NAMESPACE_DIR}/Workspace/wrk_1.yml`)).toEqual(
        expect.objectContaining({ type: 'file' }),
      );
      expect(await pNeDB.stat(`/${GIT_NAMESPACE_DIR}/Request`)).toEqual(
        expect.objectContaining({ type: 'dir' }),
      );
      expect(await pNeDB.stat(`/${GIT_NAMESPACE_DIR}/Request/req_2.yml`)).toEqual(
        expect.objectContaining({ type: 'file' }),
      );
    });
  });
});
