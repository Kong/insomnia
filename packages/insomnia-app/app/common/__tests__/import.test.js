import * as models from '../../models';
import * as importUtil from '../import';
import { getAppVersion } from '../constants';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('exportHAR()', () => {
  beforeEach(globalBeforeEach);
  it('exports a single workspace as an HTTP Archive', async () => {
    const wrk1 = await models.workspace.create({
      _id: 'wrk_1',
      name: 'Workspace 1'
    });
    const req1 = await models.request.create({
      _id: 'req_1',
      name: 'Request 1',
      parentId: wrk1._id,
      headers: [{ name: 'X-Environment', value: '{{ envvalue }}' }],
      metaSortKey: 0
    });
    const req2 = await models.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: wrk1._id,
      metaSortKey: 1
    });
    let env1Base = await models.environment.getOrCreateForWorkspace(wrk1);
    env1Base = await models.environment.update(env1Base, {
      data: {
        envvalue: 'base1'
      }
    });
    const env1Private = await models.environment.create({
      name: 'Private',
      parentId: env1Base._id,
      data: {
        envvalue: 'private1'
      }
    });
    await models.workspaceMeta.create({
      parentId: wrk1._id,
      activeEnvironmentId: env1Private._id
    });

    const wrk2 = await models.workspace.create({
      _id: 'wrk_2',
      name: 'Workspace 2'
    });
    await models.request.create({
      _id: 'req_3',
      name: 'Request 3',
      parentId: wrk2._id
    });

    const includePrivateDocs = true;
    const json = await importUtil.exportHAR(wrk1, includePrivateDocs);
    const data = JSON.parse(json);

    expect(data).toMatchObject({
      log: {
        entries: [
          {
            request: {
              headers: [{ name: 'X-Environment', value: 'private1' }]
            },
            comment: req1.name
          },
          {
            comment: req2.name
          }
        ]
      }
    });
    expect(data.log.entries.length).toBe(2);
  });
  it('exports all workspaces as an HTTP Archive', async () => {
    const wrk1 = await models.workspace.create({
      _id: 'wrk_1',
      name: 'Workspace 1'
    });
    const wrk2 = await models.workspace.create({
      _id: 'wrk_2',
      name: 'Workspace 2'
    });
    await models.request.create({
      _id: 'req_1',
      name: 'Request 1',
      parentId: wrk1._id,
      headers: [{ name: 'X-Environment', value: '{{ envvalue }}' }]
    });
    await models.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: wrk2._id,
      headers: [{ name: 'X-Environment', value: '{{ envvalue }}' }]
    });

    let env1Base = await models.environment.getOrCreateForWorkspace(wrk1);
    env1Base = await models.environment.update(env1Base, {
      data: {
        envvalue: 'base1'
      }
    });
    const env1Public = await models.environment.create({
      name: 'Public',
      parentId: env1Base._id,
      data: {
        envvalue: 'public1'
      }
    });
    const env2Base = await models.environment.getOrCreateForWorkspace(wrk2);
    await models.environment.update(env2Base, {
      data: {
        envvalue: 'base2'
      }
    });
    const env2Private = await models.environment.create({
      name: 'Private',
      isPrivate: true,
      parentId: env1Base._id,
      data: {
        envvalue: 'private2'
      }
    });

    await models.workspaceMeta.create({
      parentId: wrk1._id,
      activeEnvironmentId: env1Public._id
    });
    await models.workspaceMeta.create({
      parentId: wrk2._id,
      activeEnvironmentId: env2Private._id
    });

    const includePrivateDocs = false;
    const json = await importUtil.exportHAR(null, includePrivateDocs);
    const data = JSON.parse(json);

    expect(data).toMatchObject({
      log: {
        entries: [
          {
            request: {
              headers: [{ name: 'X-Environment', value: 'public1' }]
            },
            comment: 'Request 1'
          },
          {
            request: {
              headers: [{ name: 'X-Environment', value: 'base2' }]
            },
            comment: 'Request 2'
          }
        ]
      }
    });
  });
});

describe('exportJSON()', () => {
  beforeEach(globalBeforeEach);
  it('exports all workspaces', async () => {
    const w = await models.workspace.create({ name: 'Workspace' });
    const jar = await models.cookieJar.getOrCreateForParentId(w._id);
    const r1 = await models.request.create({
      name: 'Request',
      parentId: w._id
    });
    const eBase = await models.environment.getOrCreateForWorkspace(w);
    const ePub = await models.environment.create({
      name: 'Public',
      parentId: eBase._id
    });
    await models.environment.create({
      name: 'Private',
      isPrivate: true,
      parentId: eBase._id
    });

    const json = await importUtil.exportJSON();
    const data = JSON.parse(json);

    expect(data._type).toBe('export');
    expect(data.__export_format).toBe(3);
    expect(data.__export_date).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
    );
    expect(data.__export_source).toBe(
      `insomnia.desktop.app:v${getAppVersion()}`
    );
    expect(data.resources[0]._id).toBe(w._id);
    expect(data.resources[1]._id).toBe(eBase._id);
    expect(data.resources[2]._id).toBe(jar._id);
    expect(data.resources[3]._id).toBe(r1._id);
    expect(data.resources[4]._id).toBe(ePub._id);
    expect(data.resources.length).toBe(5);
  });
});
