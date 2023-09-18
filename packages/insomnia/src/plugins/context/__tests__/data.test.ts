import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { getAppVersion } from '../../../common/constants';
import { database as db } from '../../../common/database';
import * as models from '../../../models/index';
import { Project } from '../../../models/project';
import { WorkspaceScopeKeys } from '../../../models/workspace';
import * as plugin from '../data';

jest.mock('../../../ui/components/modals');

describe('init()', () => {
  beforeEach(globalBeforeEach);

  it('initializes correctly', async () => {
    const project = await models.project.create();
    const { data } = plugin.init(project._id);
    expect(Object.keys(data)).toEqual(['import', 'export']);
    expect(Object.keys(data.export).sort()).toEqual(['har', 'insomnia']);
    expect(Object.keys(data.import).sort()).toEqual(['raw', 'uri']);
  });
});

describe('app.import.*', () => {
  let project: Project;

  beforeEach(async () => {
    await globalBeforeEach();
    project = await models.project.create();
    await models.workspace.create({
      _id: 'wrk_1',
      created: 111,
      modified: 222,
      parentId: project._id,
    });
    await models.settings.getOrCreate();
  });

  it('uri', async () => {
    const workspace = await models.workspace.getById('wrk_1');
    expect(await db.all(models.workspace.type)).toEqual([workspace]);
    expect(await db.count(models.request.type)).toBe(0);
    const { data } = plugin.init(project._id);
    const filename = path.resolve(__dirname, '../__fixtures__/basic-import.json');
    await data.import.uri(`file://${filename}`);
    const allWorkspaces = await db.all(models.workspace.type);
    expect(allWorkspaces).toMatchObject([
      workspace,
      {
        description: '',
        name: 'New',
        parentId: project._id,
        type: 'Workspace',
        scope: WorkspaceScopeKeys.collection,
      },
    ]);

    const importedWorkspace = allWorkspaces.find(w => w.name === 'New');

    expect(importedWorkspace).toBeDefined();

    expect(await db.all(models.request.type)).toMatchObject([
      {
        isPrivate: false,
        authentication: {},
        body: {},
        description: '',
        headers: [],
        metaSortKey: 0,
        method: 'GET',
        name: 'Test',
        parameters: [],
        parentId: importedWorkspace._id,
        settingDisableRenderRequestBody: false,
        settingEncodeUrl: true,
        settingSendCookies: true,
        settingStoreCookies: true,
        settingRebuildPath: true,
        settingFollowRedirects: 'global',
        type: 'Request',
        url: 'https://insomnia.rest',
      },
    ]);
  });

  it('importRaw', async () => {
    const workspace = await models.workspace.getById('wrk_1');
    expect(await db.all(models.workspace.type)).toEqual([workspace]);
    expect(await db.count(models.request.type)).toBe(0);
    const { data } = plugin.init(project._id);
    const filename = path.resolve(__dirname, '../__fixtures__/basic-import.json');
    await data.import.raw(fs.readFileSync(filename, 'utf8'));
    const allWorkspaces = await db.all(models.workspace.type);
    expect(allWorkspaces).toMatchObject([
      workspace,
      {
        description: '',
        name: 'New',
        parentId: project._id,
        type: 'Workspace',
        scope: WorkspaceScopeKeys.collection,
      },
    ]);

    const importedWorkspace = allWorkspaces.find(w => w.name === 'New');
    expect(importedWorkspace).toBeDefined();
    expect(await db.all(models.request.type)).toMatchObject([
      {
        isPrivate: false,
        authentication: {},
        body: {},
        description: '',
        headers: [],
        metaSortKey: 0,
        method: 'GET',
        name: 'Test',
        parameters: [],
        parentId: importedWorkspace._id,
        settingDisableRenderRequestBody: false,
        settingEncodeUrl: true,
        settingSendCookies: true,
        settingStoreCookies: true,
        settingRebuildPath: true,
        settingFollowRedirects: 'global',
        type: 'Request',
        url: 'https://insomnia.rest',
      },
    ]);
  });
});

describe('app.export.*', () => {
  let project: Project;
  beforeEach(async () => {
    await globalBeforeEach();
    project = await models.project.create();
    await models.settings.getOrCreate();
    await models.workspace.create({
      _id: 'wrk_1',
      created: 111,
      modified: 222,
      parentId: project._id,
    });
    await models.request.create({
      _id: 'req_1',
      parentId: 'wrk_1',
      created: 111,
      modified: 222,
      metaSortKey: 0,
      url: 'https://insomnia.rest',
    });
    await models.response.create({
      _id: 'res_1',
      parentId: 'req_1',
      statusCode: 200,
    });
  });

  it('insomnia', async () => {
    const { data } = plugin.init(project._id);
    const exported = await data.export.insomnia();
    const exportedData = JSON.parse(exported);
    expect(typeof exportedData.__export_date).toBe('string');
    exportedData.__export_date = '2017-11-24T18:09:18.480Z';
    expect(exportedData).toEqual({
      __export_date: '2017-11-24T18:09:18.480Z',
      __export_format: 4,
      __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
      _type: 'export',
      resources: expect.arrayContaining([
        {
          _id: 'wrk_1',
          _type: 'workspace',
          created: 111,
          description: '',
          modified: 222,
          name: 'New Collection',
          parentId: null,
          scope: WorkspaceScopeKeys.collection,
        },
        {
          _id: 'req_1',
          _type: 'request',
          isPrivate: false,
          authentication: {},
          body: {},
          created: 111,
          description: '',
          headers: [],
          metaSortKey: 0,
          method: 'GET',
          modified: 222,
          name: 'New Request',
          parameters: [],
          parentId: 'wrk_1',
          settingDisableRenderRequestBody: false,
          settingEncodeUrl: true,
          settingSendCookies: true,
          settingStoreCookies: true,
          settingRebuildPath: true,
          settingFollowRedirects: 'global',
          url: 'https://insomnia.rest',
        },
      ]),
    });
  });

  it('har', async () => {
    const { data } = plugin.init(project._id);
    const exported = await data.export.har();
    const exportedData = JSON.parse(exported);
    exportedData.log.entries[0].startedDateTime = '2017-11-24T18:12:12.849Z';
    expect(exportedData).toEqual({
      log: {
        creator: {
          name: 'Insomnia REST Client',
          version: `insomnia.desktop.app:v${getAppVersion()}`,
        },
        entries: [
          {
            cache: {},
            comment: 'New Request',
            request: {
              bodySize: -1,
              cookies: [],
              headers: [],
              headersSize: -1,
              httpVersion: 'HTTP/1.1',
              method: 'GET',
              postData: {
                mimeType: '',
                params: [],
                text: '',
              },
              queryString: [],
              url: 'https://insomnia.rest/',
              settingEncodeUrl: true,
            },
            response: {
              bodySize: -1,
              content: {
                mimeType: '',
                size: 0,
                text: '',
              },
              cookies: [],
              headers: [],
              headersSize: -1,
              httpVersion: 'HTTP/1.1',
              redirectURL: '',
              status: 200,
              statusText: '',
            },
            startedDateTime: '2017-11-24T18:12:12.849Z',
            time: 0,
            timings: {
              blocked: -1,
              connect: -1,
              dns: -1,
              receive: 0,
              send: 0,
              ssl: -1,
              wait: 0,
            },
          },
        ],
        version: '1.2',
      },
    });
  });
});
