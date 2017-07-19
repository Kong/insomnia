import * as models from '../../models';
import * as importUtil from '../import';
import {getAppVersion} from '../constants';

describe('export()', () => {
  beforeEach(global.insomniaBeforeEach);
  it('succeed with username and password', async () => {
    const w = await models.workspace.create({name: 'Workspace'});
    const r1 = await models.request.create({name: 'Request', parentId: w._id});
    const eBase = await models.environment.create({name: 'Base', parentId: w._id});
    const ePub = await models.environment.create({name: 'Public', parentId: eBase._id});
    await models.environment.create({name: 'Private', isPrivate: true, parentId: eBase._id});

    const json = await importUtil.exportJSON();
    const data = JSON.parse(json);

    expect(data._type).toBe('export');
    expect(data.__export_format).toBe(3);
    expect(data.__export_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(data.__export_source).toBe(`insomnia.desktop.app:v${getAppVersion()}`);
    expect(data.resources[0]._id).toBe(w._id);
    expect(data.resources[1]._id).toBe(eBase._id);
    expect(data.resources[2]._id).toBe(r1._id);
    expect(data.resources[3]._id).toBe(ePub._id);
    expect(data.resources.length).toBe(4);
  });
});
