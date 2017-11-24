import * as plugin from '../app';
import * as modals from '../../../ui/components/modals';
import path from 'path';
import {globalBeforeEach} from '../../../__jest__/before-each';
import * as models from '../../../models/index';
import * as db from '../../../common/database';
import fs from 'fs';

const PLUGIN = {
  name: 'my-plugin',
  version: '1.0.0',
  directory: '/plugins/my-plugin',
  module: {}
};

describe('init()', () => {
  beforeEach(globalBeforeEach);
  it('initializes correctly', async () => {
    const result = plugin.init({name: PLUGIN}, await models.workspace.create());
    expect(Object.keys(result)).toEqual(['app']);
    expect(Object.keys(result.app).sort()).toEqual([
      'alert',
      'getPath',
      'importRaw',
      'importUri',
      'showSaveDialog'
    ]);
  });
});

describe('app.alert()', () => {
  beforeEach(globalBeforeEach);
  it('shows alert with message', async () => {
    modals.showAlert = jest.fn().mockReturnValue('dummy-return-value');
    const result = plugin.init(PLUGIN, await models.workspace.create());

    // Make sure it returns result of showAlert()
    expect(result.app.alert()).toBe('dummy-return-value');
    expect(result.app.alert('My message')).toBe('dummy-return-value');

    // Make sure it passes correct arguments
    expect(modals.showAlert.mock.calls).toEqual([
      [{message: '', title: 'Plugin my-plugin'}],
      [{message: 'My message', title: 'Plugin my-plugin'}]
    ]);
  });
});

describe('app.importUri()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    await models.workspace.create({
      _id: 'wrk_1',
      created: 111,
      modified: 222
    });
  });
  it('importUri', async () => {
    modals.showModal = jest.fn();
    const workspace = await models.workspace.getById('wrk_1');
    expect(await db.all(models.workspace.type)).toEqual([workspace]);
    expect(await db.count(models.request.type)).toBe(0);

    const result = plugin.init(PLUGIN, workspace);
    const filename = path.resolve(__dirname, '../__fixtures__/basic-import.json');
    await result.app.importUri(`file://${filename}`);

    const allWorkspaces = await db.all(models.workspace.type);
    expect(allWorkspaces).toEqual([
      workspace,
      {
        _id: 'wrk_imported_1',
        created: 888,
        modified: 999,
        description: '',
        name: 'New',
        parentId: null,
        type: 'Workspace'
      }
    ]);
    expect(await db.all(models.request.type)).toEqual([{
      _id: 'req_imported_1',
      authentication: {},
      body: {},
      created: 111,
      description: '',
      headers: [],
      metaSortKey: 0,
      method: 'GET',
      modified: 222,
      name: 'Test',
      parameters: [],
      parentId: 'wrk_imported_1',
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true,
      settingSendCookies: true,
      settingStoreCookies: true,
      type: 'Request',
      url: 'https://insomnia.rest'
    }]);
  });
  it('importRaw', async () => {
    modals.showModal = jest.fn();
    const workspace = await models.workspace.getById('wrk_1');
    expect(await db.all(models.workspace.type)).toEqual([workspace]);
    expect(await db.count(models.request.type)).toBe(0);

    const result = plugin.init(PLUGIN, workspace);
    const filename = path.resolve(__dirname, '../__fixtures__/basic-import.json');
    await result.app.importRaw(fs.readFileSync(filename, 'utf8'));

    const allWorkspaces = await db.all(models.workspace.type);
    expect(allWorkspaces).toEqual([
      workspace,
      {
        _id: 'wrk_imported_1',
        created: 888,
        modified: 999,
        description: '',
        name: 'New',
        parentId: null,
        type: 'Workspace'
      }
    ]);
    expect(await db.all(models.request.type)).toEqual([{
      _id: 'req_imported_1',
      authentication: {},
      body: {},
      created: 111,
      description: '',
      headers: [],
      metaSortKey: 0,
      method: 'GET',
      modified: 222,
      name: 'Test',
      parameters: [],
      parentId: 'wrk_imported_1',
      settingDisableRenderRequestBody: false,
      settingEncodeUrl: true,
      settingSendCookies: true,
      settingStoreCookies: true,
      type: 'Request',
      url: 'https://insomnia.rest'
    }]);
  });
});
