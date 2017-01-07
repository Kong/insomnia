import * as sync from '../index';
import * as session from '../session';
import * as models from '../../models';
import * as db from '../../common/database';
import * as syncStorage from '../storage';
import * as crypt from '../crypt';

describe('Test push behaviour', () => {
  beforeEach(async () => {
    // Reset some things
    sync._testReset();
    await _setSessionData();
    await _setupSessionMocks();

    // Init sync and storage
    const config = {inMemoryOnly: true, autoload: false, filename: null};
    await syncStorage.initDB(config, true);
    await db.init(models.types(), config, true);

    // Add some data
    await models.workspace.create({_id: 'wrk_1', name: 'Workspace 1'});
    await models.workspace.create({_id: 'wrk_2', name: 'Workspace 2'});
    await models.request.create({_id: 'req_1', name: 'Request 1', parentId: 'wrk_1'});
    await models.request.create({_id: 'req_2', name: 'Request 2', parentId: 'wrk_2'});
  });

  it('Pushes sync mode with and without resource group id', async () => {
    const request = await models.request.getById('req_1');
    const request2 = await models.request.getById('req_2');
    const rg = await sync.createResourceGroup('Synced Resource Group');
    const rg2 = await sync.createResourceGroup('Unsynced Resource Group');
    await sync.createOrUpdateConfig(rg.id, syncStorage.SYNC_MODE_ON);
    await sync.createOrUpdateConfig(rg2.id, syncStorage.SYNC_MODE_OFF);
    await sync.createResource(request, rg.id);
    await sync.createResource(request2, rg2.id);

    await sync.pushActiveDirtyResources(); // Push only active configs
    await sync.pushActiveDirtyResources(rg.id); // Force push rg_1
    await sync.pushActiveDirtyResources(rg2.id); // Force push rg_2

    expect(session.syncPush.mock.calls.length).toBe(3);
    expect(session.syncPush.mock.calls[0][0].length).toBe(1);
    expect(session.syncPush.mock.calls[0][0][0].id).toBe('req_1');
    expect(session.syncPush.mock.calls[1][0].length).toBe(1);
    expect(session.syncPush.mock.calls[1][0][0].id).toBe('req_1');
    expect(session.syncPush.mock.calls[2][0].length).toBe(1);
    expect(session.syncPush.mock.calls[2][0][0].id).toBe('req_2');
  });

  it('Updates dirty flag for push response', async () => {
    const request = await models.request.getById('req_1');
    const rg = await sync.createResourceGroup('Synced Resource Group');
    await sync.createOrUpdateConfig(rg.id, syncStorage.SYNC_MODE_ON);
    await sync.createResourceForDoc(request, rg.id);

    session.syncPush.mockReturnValueOnce({
      updated: [],
      created: [{id: request._id, version: 'new-version'}],
      removed: [],
      conflicts: [],
    });

    const resourceBefore = await syncStorage.getResourceByDocId(request._id);
    await sync.pushActiveDirtyResources();
    const resourceAfter = await syncStorage.getResourceByDocId(request._id);

    expect(session.syncPush.mock.calls.length).toBe(1);
    expect(session.syncPush.mock.calls[0][0].length).toBe(2);
    expect(session.syncPush.mock.calls[0][0][0].id).toBe('req_1');
    expect(session.syncPush.mock.calls[0][0][1].id).toBe('wrk_1');
    expect(resourceBefore.dirty).toBe(true);
    expect(resourceAfter.dirty).toBe(false);
  });
});

describe('Integration tests for creating Resources and pushing', () => {
  beforeEach(async () => {
    // Reset some things
    await _setSessionData();
    sync._testReset();

    // Mock some things
    await _setupSessionMocks();
    jest.useFakeTimers();

    // Init storage
    const config = {inMemoryOnly: true, autoload: false, filename: null};
    await syncStorage.initDB(config, true);
    await db.init(models.types(), config, true);

    // Add some data
    await models.workspace.create({_id: 'wrk_empty', name: 'Workspace Empty'});
    await models.workspace.create({_id: 'wrk_1', name: 'Workspace 1'});
    await models.request.create({_id: 'req_1', name: 'Request 1', parentId: 'wrk_1'});
    await models.request.create({_id: 'req_2', name: 'Request 2', parentId: 'wrk_1'});
    await models.request.create({_id: 'req_3', name: 'Request 3', parentId: 'wrk_1'});
    await models.cookieJar.create({_id: 'jar_1', name: 'Jar 1', parentId: 'wrk_1'});
    await models.environment.create({_id: 'env_1', name: 'Env 1', parentId: 'wrk_1'});

    // Flush changes just to be sure they won't affect our tests
    await db.flushChanges();

    // Assert that all our new models were created
    expect((await models.workspace.all()).length).toBe(2);
    expect((await models.request.all()).length).toBe(3);
    expect((await models.environment.all()).length).toBe(1);
    expect((await models.cookieJar.all()).length).toBe(1);

    // Assert that initializing sync will create the initial resources
    expect((await syncStorage.allConfigs()).length).toBe(0);
    expect((await syncStorage.allResources()).length).toBe(0);
    const promise = sync.init();
    jest.runOnlyPendingTimers();
    await promise;
    expect((await syncStorage.allConfigs()).length).toBe(2);
    expect((await syncStorage.allResources()).length).toBe(7);
  });

  it('Resources created on DB change', async () => {
    // Fetch the workspace and create a new request
    db.bufferChanges();
    await models.request.create({
      _id: 'req_t',
      url: 'https://google.com',
      parentId: 'wrk_1'
    });

    await db.flushChanges();
    await sync.pushActiveDirtyResources();

    // Push changes and get resource
    const resource = await syncStorage.getResourceByDocId('req_t');

    // Assert
    expect((await syncStorage.allConfigs()).length).toBe(2);
    expect((await syncStorage.allResources()).length).toBe(8);
    expect(_decryptResource(resource).url).toBe('https://google.com');
    expect(resource.removed).toBe(false);

    expect(session.syncPush.mock.calls.length).toBe(2);
    expect(session.syncPush.mock.calls[0][0].length).toBe(7);
    // NOTE: This would be 1 if we were mocking the "push" response properly
    // and telling the client to set the created docs to dirty=false
    expect(session.syncPush.mock.calls[1][0].length).toBe(8);

    expect(session.syncPull.mock.calls.length).toBe(1);
    expect(session.syncPull.mock.calls[0][0].blacklist.length).toBe(0);
    expect(session.syncPull.mock.calls[0][0].resources.length).toEqual(7);
  });

  it('Resources update on DB change', async () => {
    // Create, update a request, and fetch it's resource
    const request = await models.request.getById('req_1');
    const resource = await syncStorage.getResourceByDocId(request._id);
    db.bufferChanges();
    const updatedRequest = await models.request.update(request, {name: 'New Name'});

    // Drain and fetch new resource
    await db.flushChanges();
    await sync.pushActiveDirtyResources();
    const updatedResource = await syncStorage.getResourceByDocId(request._id);

    // Assert
    expect(request.name).toBe('Request 1');
    expect(_decryptResource(resource).name).toBe('Request 1');
    expect(updatedRequest.name).toBe('New Name');
    expect(_decryptResource(updatedResource).name).toBe('New Name');
    expect(resource.removed).toBe(false);

    expect(session.syncPush.mock.calls.length).toBe(2);
    expect(session.syncPush.mock.calls[0][0].length).toBe(7);
    expect(session.syncPush.mock.calls[1][0].length).toBe(7);

    expect(session.syncPull.mock.calls.length).toBe(1);
    expect(session.syncPull.mock.calls[0][0].blacklist.length).toBe(0);
    expect(session.syncPull.mock.calls[0][0].resources.length).toEqual(7);
  });

  it('Resources removed on DB change', async () => {
    // Create, update a request, and fetch it's resource
    const request = await models.request.getById('req_1');
    const resource = await syncStorage.getResourceByDocId(request._id);
    db.bufferChanges();
    await models.request.remove(request);

    // Drain and fetch new resource
    await db.flushChanges();
    await sync.pushActiveDirtyResources();
    const updatedResource = await syncStorage.getResourceByDocId(request._id);

    // Assert
    expect(resource.removed).toBe(false);
    expect(updatedResource.removed).toBe(true);

    expect(session.syncPush.mock.calls.length).toBe(2);
    expect(session.syncPush.mock.calls[0][0].length).toBe(7);
    expect(session.syncPush.mock.calls[1][0].length).toBe(7);

    expect(session.syncPull.mock.calls.length).toBe(1);
    expect(session.syncPull.mock.calls[0][0].blacklist.length).toBe(0);
    expect(session.syncPull.mock.calls[0][0].resources.length).toEqual(7);
  });
});

// ~~~~~~~ //
// Helpers //
// ~~~~~~~ //

function _decryptResource (resource) {
  const message = JSON.parse(resource.encContent);
  const fakeKey = 'aaaaa';
  const docJSON = crypt.decryptAES(fakeKey, message);
  return JSON.parse(docJSON);
}

async function _setSessionData () {
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

  const {privateKey} = await crypt.generateKeyPairJWK();
  const encPrivateKey = {
    ad: '',
    d: (new Buffer(JSON.stringify(privateKey))).toString('hex'),
    iv: '968f1d810efdaec58f9e313e',
    t: '0e87a2e57a198ca79cb99585fe9c244a',
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
    encPrivateKey,
  );
}

async function _setupSessionMocks () {
  const resourceGroups = {};

  session.syncCreateResourceGroup = jest.fn(body => {
    const id = `rg_${Object.keys(resourceGroups).length + 1}`;

    // Generate a public key and use a symmetric equal to it's Id for
    // convenience
    const publicKey = session.getPublicKey();
    const symmetricKeyStr = JSON.stringify({k: id});
    const encSymmetricKey = crypt.encryptRSAWithJWK(publicKey, symmetricKeyStr);

    // Store the resource group and return it
    resourceGroups[id] = Object.assign({}, {id, encSymmetricKey}, body);
    return resourceGroups[id];
  });

  session.syncGetResourceGroup = jest.fn(id => {
    if (resourceGroups[id]) {
      return resourceGroups[id];
    }

    const err = new Error(`Not Found for ${id}`);
    err.statusCode = 404;
    throw err
  });

  session.syncPull = jest.fn(body => ({
    updatedResources: [],
    createdResources: [],
    idsToPush: [],
    idsToRemove: [],
  }));

  session.syncPush = jest.fn(body => ({
    conflicts: [],
    updated: [],
    created: [],
    removed: [],
  }));
}
