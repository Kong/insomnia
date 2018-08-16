import * as sync from '../index';
import * as session from '../session';
import * as models from '../../models';
import * as db from '../../common/database';
import * as syncStorage from '../storage';
import * as crypt from '../crypt';
import { globalBeforeEach } from '../../__jest__/before-each';

describe('Test push/pull behaviour', () => {
  beforeEach(async () => {
    await globalBeforeEach();

    // Reset some things
    sync._testReset();
    await _setSessionData();
    await _setupSessionMocks();

    // Init sync and storage
    const config = { inMemoryOnly: true, autoload: false, filename: null };
    await syncStorage.initDB(config, true);

    // Add some data
    await models.workspace.create({ _id: 'wrk_1', name: 'Workspace 1' });
    await models.workspace.create({ _id: 'wrk_2', name: 'Workspace 2' });
    await models.request.create({
      _id: 'req_1',
      name: 'Request 1',
      parentId: 'wrk_1'
    });
    await models.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: 'wrk_2'
    });

    // Create resources, resource groups, and configs
    const workspaces = await models.workspace.all();
    const requests = await models.request.all();
    for (const d of [...workspaces, ...requests]) {
      await sync.getOrCreateResourceForDoc(d);
    }
  });

  it('Pushes sync mode with and without resource group id', async () => {
    const request = await models.request.getById('req_1');
    const request2 = await models.request.getById('req_2');
    const resourceRequest = await syncStorage.getResourceByDocId(request._id);
    const resourceRequest2 = await syncStorage.getResourceByDocId(request2._id);

    // Set up sync modes
    await sync.createOrUpdateConfig(resourceRequest.resourceGroupId, {
      syncMode: syncStorage.SYNC_MODE_ON
    });
    await sync.createOrUpdateConfig(resourceRequest2.resourceGroupId, {
      syncMode: syncStorage.SYNC_MODE_UNSET
    });

    await sync.push(); // Push only active configs
    await sync.push(resourceRequest.resourceGroupId); // Force push rg_1
    await sync.push(resourceRequest2.resourceGroupId); // Force push rg_2

    expect(session.syncPush.mock.calls.length).toBe(3);
    expect(session.syncPush.mock.calls[0][0].length).toBe(2);
    expect(session.syncPush.mock.calls[0][0][0].id).toBe('wrk_1');
    expect(session.syncPush.mock.calls[0][0][1].id).toBe('req_1');
    expect(session.syncPush.mock.calls[1][0].length).toBe(2);
    expect(session.syncPush.mock.calls[1][0][0].id).toBe('wrk_1');
    expect(session.syncPush.mock.calls[1][0][1].id).toBe('req_1');
    expect(session.syncPush.mock.calls[2][0].length).toBe(2);
    expect(session.syncPush.mock.calls[2][0][0].id).toBe('wrk_2');
    expect(session.syncPush.mock.calls[2][0][1].id).toBe('req_2');
  });

  it('Updates dirty flag for push response', async () => {
    const request = await models.request.getById('req_1');
    const resourceRequest = await syncStorage.getResourceByDocId(request._id);
    await sync.createOrUpdateConfig(resourceRequest.resourceGroupId, {
      syncMode: syncStorage.SYNC_MODE_ON
    });

    session.syncPush.mockReturnValueOnce({
      updated: [],
      created: [{ id: request._id, version: 'new-version' }],
      removed: [],
      conflicts: []
    });

    const resourceBefore = await syncStorage.getResourceByDocId(request._id);
    await sync.push(resourceRequest.resourceGroupId);
    const resourceAfter = await syncStorage.getResourceByDocId(request._id);

    expect(session.syncPush.mock.calls.length).toBe(1);
    expect(session.syncPush.mock.calls[0][0].length).toBe(2);
    expect(session.syncPush.mock.calls[0][0][0].id).toBe('wrk_1');
    expect(session.syncPush.mock.calls[0][0][1].id).toBe('req_1');
    expect(resourceBefore.dirty).toBe(true);
    expect(resourceAfter.dirty).toBe(false);
  });

  it('Updates resources for pull response', async () => {
    const request = await models.request.getById('req_1');
    const request2 = await models.request.getById('req_2');
    const requestNew = Object.assign({}, request, {
      _id: 'req_new',
      name: 'New Request'
    });
    const resourceBefore = await syncStorage.getResourceByDocId(request._id);
    const resource2Before = await syncStorage.getResourceByDocId(requestNew._id);
    await sync.createOrUpdateConfig(resourceBefore.resourceGroupId, {
      syncMode: syncStorage.SYNC_MODE_ON
    });
    const updatedRequest = Object.assign({}, request, {
      name: 'Request Updated'
    });
    const updatedResource = Object.assign({}, resourceBefore, {
      version: 'ver1',
      encContent: await sync.encryptDoc(resourceBefore.resourceGroupId, updatedRequest)
    });
    const createdResourceNew = Object.assign({}, resourceBefore, {
      id: requestNew._id,
      resourceGroupId: 'rg_1',
      encContent: await sync.encryptDoc(resourceBefore.resourceGroupId, requestNew)
    });

    session.syncPull.mockReturnValueOnce({
      updatedResources: [updatedResource],
      createdResources: [createdResourceNew],
      idsToPush: [],
      idsToRemove: ['req_2']
    });

    // Pull and get docs/resources
    await sync.pull(resourceBefore.resourceGroupId);
    const requestAfter = await models.request.getById(request._id);
    const request2After = await models.request.getById(request2._id);
    const requestNewAfter = await models.request.getById('req_new');
    const resourceAfter = await syncStorage.getResourceByDocId(
      request._id,
      resourceBefore.resourceGroupId
    );
    const resource2After = await syncStorage.getResourceByDocId(request2._id);
    const resourceNewAfter = await syncStorage.getResourceByDocId(requestNewAfter._id);

    // Assert
    expect(resourceBefore.version).toBe('__NO_VERSION__');
    expect(resourceAfter.version).toBe(updatedResource.version);
    expect(resourceBefore.dirty).toBe(true);
    expect(resource2Before).toBe(null);
    expect(resourceAfter.dirty).toBe(false);
    expect(resource2After.removed).toBe(true);
    expect(requestAfter.name).toBe('Request Updated');
    expect(request2After).toBe(null);
    expect(resourceNewAfter).not.toBe(null);
  });

  it('Conflict: local version wins on modified before', async () => {
    const requestClient = await models.request.getById('req_1');
    const requestServer = Object.assign({}, requestClient, {
      name: 'Server Request'
    });
    const resourceRequest = await syncStorage.getResourceByDocId(requestClient._id);
    const resourceConflict = Object.assign({}, resourceRequest, {
      version: 'ver-2',
      encContent: await sync.encryptDoc(resourceRequest.resourceGroupId, requestServer),
      lastEdited: resourceRequest.lastEdited - 1000 // Same edited time
    });

    session.syncPush.mockReturnValueOnce({
      updated: [],
      created: [],
      removed: [],
      conflicts: [resourceConflict]
    });

    await sync.push(resourceRequest.resourceGroupId);
    const resourceAfter = await syncStorage.getResourceByDocId(
      requestClient._id,
      resourceRequest.resourceGroupId
    );
    const requestAfter = await models.request.getById(requestClient._id);

    // Assert
    expect(session.syncPush.mock.calls.length).toBe(1);
    expect(session.syncPush.mock.calls[0][0].length).toBe(2);
    // Even when local wins, local resource gets the remove resource version
    expect(resourceAfter.version).toBe(resourceConflict.version);
    // Local resource gets marked as dirty so it's pushed right away
    expect(resourceAfter.dirty).toBe(true);
    // Local db should not be changed since the local won
    expect(requestAfter).toEqual(requestClient);
  });

  it('Conflict: local version wins on modified tie', async () => {
    const requestClient = await models.request.getById('req_1');
    const requestServer = Object.assign({}, requestClient, {
      name: 'Server Request'
    });
    const resourceRequest = await syncStorage.getResourceByDocId(requestClient._id);
    const resourceConflict = Object.assign({}, resourceRequest, {
      version: 'ver-2',
      encContent: await sync.encryptDoc(resourceRequest.resourceGroupId, requestServer),
      lastEdited: resourceRequest.lastEdited // Same edited time
    });

    session.syncPush.mockReturnValueOnce({
      updated: [],
      created: [],
      removed: [],
      conflicts: [resourceConflict]
    });

    await sync.push(resourceRequest.resourceGroupId);
    const resourceAfter = await syncStorage.getResourceByDocId(
      requestClient._id,
      resourceRequest.resourceGroupId
    );
    const requestAfter = await models.request.getById(requestClient._id);

    // Assert
    expect(session.syncPush.mock.calls.length).toBe(1);
    expect(session.syncPush.mock.calls[0][0].length).toBe(2);
    // Even when local wins, local resource gets the remove resource version
    expect(resourceAfter.version).toBe(resourceConflict.version);
    // Local resource gets marked as dirty so it's pushed right away
    expect(resourceAfter.dirty).toBe(true);
    // Local db should not be changed since the local won
    expect(requestAfter).toEqual(requestClient);
  });

  it('Conflict: server version wins if modified after', async () => {
    const requestClient = await models.request.getById('req_1');
    const requestServer = Object.assign({}, requestClient, {
      name: 'Server Request'
    });
    const resourceRequest = await syncStorage.getResourceByDocId(requestClient._id);
    const resourceConflict = Object.assign({}, resourceRequest, {
      version: 'ver-2',
      encContent: await sync.encryptDoc(resourceRequest.resourceGroupId, requestServer),
      lastEdited: resourceRequest.lastEdited + 1000
    });

    session.syncPush.mockReturnValueOnce({
      updated: [],
      created: [],
      removed: [],
      conflicts: [resourceConflict]
    });

    await sync.push(resourceRequest.resourceGroupId);
    const resourceAfter = await syncStorage.getResourceByDocId(
      requestClient._id,
      resourceRequest.resourceGroupId
    );
    const requestAfter = await models.request.getById(requestClient._id);

    // Assert
    expect(session.syncPush.mock.calls.length).toBe(1);
    expect(session.syncPush.mock.calls[0][0].length).toBe(2);
    expect(resourceAfter.lastEdited).toBeGreaterThan(resourceRequest.lastEdited);
    expect(resourceAfter.version).toBe(resourceConflict.version);
    // Local resource gets marked as dirty so it's pushed right away
    expect(resourceAfter.dirty).toBe(false);
    expect(requestAfter.name).toBe('Server Request');
    expect(requestAfter.modified).toBe(requestServer.modified);
  });
});

describe('Integration tests for creating Resources and pushing', () => {
  beforeEach(async () => {
    await globalBeforeEach();

    // Reset some things
    await _setSessionData();
    sync._testReset();

    // Mock some things
    await _setupSessionMocks();
    jest.useFakeTimers();

    // Init storage
    const config = { inMemoryOnly: true, autoload: false, filename: null };
    await syncStorage.initDB(config, true);

    // Add some data
    await models.workspace.create({
      _id: 'wrk_empty',
      name: 'Workspace Empty'
    });
    await models.workspace.create({ _id: 'wrk_1', name: 'Workspace 1' });
    await models.request.create({
      _id: 'req_1',
      name: 'Request 1',
      parentId: 'wrk_1'
    });
    await models.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: 'wrk_1'
    });
    await models.request.create({
      _id: 'req_3',
      name: 'Request 3',
      parentId: 'wrk_1'
    });
    await models.environment.create({
      _id: 'env_2',
      name: 'Env Prv',
      parentId: 'wrk_1',
      isPrivate: true
    });

    // Flush changes just to be sure they won't affect our tests
    await db.flushChanges();
    await sync.writePendingChanges();

    // Assert that all our new models were created
    expect((await models.workspace.all()).length).toBe(2);
    expect((await models.request.all()).length).toBe(3);
    expect((await models.environment.all()).length).toBe(1);
    expect((await models.cookieJar.all()).length).toBe(0);

    // Assert that initializing sync will create the initial resources
    expect((await syncStorage.allConfigs()).length).toBe(0);
    expect((await syncStorage.allResources()).length).toBe(0);
    const promise = sync.init();
    jest.runOnlyPendingTimers();
    await promise;
    expect((await syncStorage.allConfigs()).length).toBe(2);
    expect((await syncStorage.allResources()).length).toBe(5);

    // Mark all configs as auto sync
    const configs = await syncStorage.allConfigs();
    for (const config of configs) {
      await syncStorage.updateConfig(config, {
        syncMode: syncStorage.SYNC_MODE_ON
      });
    }

    // Do initial push
    await sync.push();

    // Reset mocks once again before tests
    await _setupSessionMocks();
  });

  it('Resources created on DB change', async () => {
    // Fetch the workspace and create a new request
    await db.bufferChanges();
    await models.request.create({
      _id: 'req_t',
      url: 'https://google.com',
      parentId: 'wrk_1'
    });

    await db.flushChanges();
    await sync.writePendingChanges();
    await sync.push();

    // Push changes and get resource
    const resource = await syncStorage.getResourceByDocId('req_t');

    // Assert
    expect((await syncStorage.allConfigs()).length).toBe(2);
    expect((await syncStorage.allResources()).length).toBe(6);
    expect(_decryptResource(resource).url).toBe('https://google.com');
    expect(resource.removed).toBe(false);

    expect(session.syncPush.mock.calls.length).toBe(1);
    expect(session.syncPush.mock.calls[0][0].length).toBe(6);

    expect(session.syncPull.mock.calls).toEqual([]);
  });

  it('Resources revived on DB change', async () => {
    // Fetch the workspace and create a new request
    await db.bufferChanges();
    const request = await models.request.create({
      _id: 'req_t',
      name: 'Original Request',
      parentId: 'wrk_1'
    });
    await db.flushChanges();
    await sync.writePendingChanges();
    await sync.push();

    // Mark resource as removed
    const originalResource = await syncStorage.getResourceByDocId('req_t');
    const updatedResource = await syncStorage.updateResource(originalResource, {
      removed: true
    });

    // Update it and push it again
    await db.bufferChanges();
    await models.request.update(request, { name: 'New Name' });
    await db.flushChanges();
    await sync.writePendingChanges();
    await sync.push();
    const finalResource = await syncStorage.getResourceByDocId('req_t');

    // Assert
    expect(originalResource.removed).toBe(false);
    expect(updatedResource.removed).toBe(true);
    expect(finalResource.removed).toBe(false);
  });

  it('Resources update on DB change', async () => {
    // Create, update a request, and fetch it's resource
    const request = await models.request.getById('req_1');
    const resource = await syncStorage.getResourceByDocId(request._id);
    await db.bufferChanges();
    const updatedRequest = await models.request.update(request, {
      name: 'New Name'
    });

    // Drain and fetch new resource
    await db.flushChanges();
    await sync.writePendingChanges();
    await sync.push();
    const updatedResource = await syncStorage.getResourceByDocId(request._id);

    // Assert
    expect(request.name).toBe('Request 1');
    expect(_decryptResource(resource).name).toBe('Request 1');
    expect(updatedRequest.name).toBe('New Name');
    expect(_decryptResource(updatedResource).name).toBe('New Name');
    expect(resource.removed).toBe(false);

    expect(session.syncPush.mock.calls.length).toBe(1);
    expect(session.syncPush.mock.calls[0][0].length).toBe(5);

    expect(session.syncPull.mock.calls).toEqual([]);
  });

  it('Resources removed on DB change', async () => {
    // Create, update a request, and fetch it's resource
    const request = await models.request.getById('req_1');
    const resource = await syncStorage.getResourceByDocId(request._id);
    await db.bufferChanges();
    await models.request.remove(request);

    // Drain and fetch new resource
    await db.flushChanges();
    await sync.writePendingChanges();
    await sync.push();
    const updatedResource = await syncStorage.getResourceByDocId(request._id);

    // Assert
    expect(resource.removed).toBe(false);
    expect(updatedResource.removed).toBe(true);

    expect(session.syncPush.mock.calls.length).toBe(1);
    expect(session.syncPush.mock.calls[0][0].length).toBe(5);

    expect(session.syncPull.mock.calls).toEqual([]);
  });
});

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

function _decryptResource(resource) {
  const message = JSON.parse(resource.encContent);
  const fakeKey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const docJSON = crypt.decryptAES(fakeKey, message);
  return JSON.parse(docJSON);
}

async function _setSessionData() {
  const symmetricKey = {
    alg: 'A256GCM',
    ext: true,
    k: '3-QU2OcQcpSyFIoL8idgclbImP3M8Y2d0oVAca3Vl4g',
    key_ops: ['encrypt', 'decrypt'],
    kty: 'oct'
  };

  const publicKey = {
    alg: 'RSA-OAEP-256',
    e: 'AQAB',
    ext: true,
    key_ops: ['encrypt'],
    kty: 'RSA',
    n: 'aaaa'
  };

  const { privateKey } = await crypt.generateKeyPairJWK();
  const encPrivateKey = {
    ad: '',
    d: Buffer.from(JSON.stringify(privateKey)).toString('hex'),
    iv: '968f1d810efdaec58f9e313e',
    t: '0e87a2e57a198ca79cb99585fe9c244a'
  };

  // Setup mocks and stuff
  session.setSessionData(
    'ses_123',
    'acct_123',
    'Tammy',
    'Tester',
    'gschier1990@gmail.com',
    symmetricKey,
    publicKey,
    encPrivateKey
  );
}

async function _setupSessionMocks() {
  const resourceGroups = {};

  session.syncCreateResourceGroup = jest.fn((parentId, name, _) => {
    const id = `rg_${Object.keys(resourceGroups).length + 1}`;

    // Generate a public key and use a symmetric equal to it's Id for
    // convenience
    const publicKey = session.getPublicKey();
    const symmetricKeyStr = JSON.stringify({ k: id });
    const encSymmetricKey = crypt.encryptRSAWithJWK(publicKey, symmetricKeyStr);

    // Store the resource group and return it
    resourceGroups[id] = Object.assign(
      {},
      { id, encSymmetricKey },
      {
        parentResourceId: parentId,
        name: name,
        encSymmetricKey: encSymmetricKey
      }
    );
    return resourceGroups[id];
  });

  session.syncGetResourceGroup = jest.fn(id => {
    if (resourceGroups[id]) {
      return resourceGroups[id];
    }

    const err = new Error(`Not Found for ${id}`);
    err.statusCode = 404;
    throw err;
  });

  session.syncPull = jest.fn(body => ({
    updatedResources: [],
    createdResources: [],
    idsToPush: [],
    idsToRemove: []
  }));

  session.syncPush = jest.fn(body => ({
    conflicts: [],
    updated: [],
    created: [],
    removed: []
  }));
}
