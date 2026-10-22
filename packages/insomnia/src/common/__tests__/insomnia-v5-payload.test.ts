/**
 * A Socket.IO / WebSocket request's body lives in its own document (SocketIOPayload /
 * WebSocketPayload) rather than on the request, and used to be absent from the v5 format
 * entirely. These tests pin it to the format: INS-3123.
 */

import type { Workspace } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { database as db } from '../database';
import { importResourcesToNewWorkspace } from '../import';
import { getInsomniaV5DataExport, importInsomniaV5Data } from '../insomnia-v5';

const WORKSPACE_ID = 'wrk_payload';
const SOCKET_IO_REQUEST_ID = 'socketio-req_payload';
const WEBSOCKET_REQUEST_ID = 'ws-req_payload';

const exportWorkspace = (workspaceId = WORKSPACE_ID) =>
  getInsomniaV5DataExport({ workspaceId, includePrivateEnvironments: false });

const findNode = (yaml: string, name: string) =>
  YAML.parse(yaml).collection.find((item: { name: string }) => item.name === name);

const createSocketIORequest = (patch: Record<string, unknown> = {}) =>
  services.socketIORequest.create({
    _id: SOCKET_IO_REQUEST_ID,
    name: 'socketio-request',
    parentId: WORKSPACE_ID,
    url: 'https://socket.example.com',
    metaSortKey: 1,
    ...patch,
  });

// @vitest-environment jsdom
describe('Socket.IO / WebSocket payloads in the v5 format', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true });
    await services.project.create({ _id: 'proj_payload', name: 'Payload Project' });
    await services.workspace.create({
      _id: WORKSPACE_ID,
      name: 'Payload Workspace',
      parentId: 'proj_payload',
      scope: 'collection',
    });
    await services.environment.getOrCreateForParentId(WORKSPACE_ID);
    await services.settings.getOrCreate();
  });

  describe('export', () => {
    // Opening a Socket.IO request creates an empty payload document, which must not turn into a
    // `body:` block — otherwise every repo gains a spurious git diff from merely browsing
    it('omits body for a payload created by only opening the request', async () => {
      await createSocketIORequest();
      await services.socketIOPayload.getOrCreateByParentId(SOCKET_IO_REQUEST_ID);

      expect(findNode(await exportWorkspace(), 'socketio-request').body).toBeUndefined();
    });

    it('omits body for an untouched WebSocket payload', async () => {
      await services.webSocketRequest.create({
        _id: WEBSOCKET_REQUEST_ID,
        name: 'websocket-request',
        parentId: WORKSPACE_ID,
        url: 'wss://echo.example.com',
        metaSortKey: 2,
      });
      await services.webSocketPayload.create({ parentId: WEBSOCKET_REQUEST_ID });

      expect(findNode(await exportWorkspace(), 'websocket-request').body).toBeUndefined();
    });

    it('emits every arg once any of them has content', async () => {
      await createSocketIORequest();
      await services.socketIOPayload.create({
        parentId: SOCKET_IO_REQUEST_ID,
        args: [
          { id: 'arg1', value: '"world"', mode: 'application/json' },
          { id: 'arg2', value: '', mode: 'text/plain' },
        ],
      });

      expect(findNode(await exportWorkspace(), 'socketio-request').body.args).toEqual([
        { id: 'arg1', value: '"world"', mode: 'application/json' },
        { id: 'arg2', value: '', mode: 'text/plain' },
      ]);
    });

    // Arg rows and content types are configuration in their own right. Calling these untouched
    // would omit the body, and the next sync's `deleteOrphans` would then delete the payload.
    it('emits a body for an arg the user added but left blank', async () => {
      await createSocketIORequest();
      const { args } = models.socketIOPayload.init();
      await services.socketIOPayload.create({
        parentId: SOCKET_IO_REQUEST_ID,
        args: [...args, { id: 'arg2', value: '', mode: args[0].mode }],
      });

      expect(findNode(await exportWorkspace(), 'socketio-request').body.args).toHaveLength(2);
    });

    it('emits a body when only an arg content type changed', async () => {
      await createSocketIORequest();
      const { args } = models.socketIOPayload.init();
      await services.socketIOPayload.create({
        parentId: SOCKET_IO_REQUEST_ID,
        args: [{ ...args[0], mode: 'text/plain' }],
      });

      expect(findNode(await exportWorkspace(), 'socketio-request').body.args).toMatchObject([
        { value: '', mode: 'text/plain' },
      ]);
    });
  });

  describe('import', () => {
    it('recreates the payload as a child of its request', async () => {
      await createSocketIORequest();
      await services.socketIOPayload.create({
        _id: 'socket-io-payload_known',
        parentId: SOCKET_IO_REQUEST_ID,
        eventName: 'chat message',
        ack: true,
        args: [{ id: 'arg1', value: '"world"', mode: 'application/json' }],
      });

      const resources = importInsomniaV5Data(await exportWorkspace());
      const payload = resources.find(resource => resource.type === 'SocketIOPayload');

      expect(payload).toMatchObject({
        _id: 'socket-io-payload_known',
        parentId: SOCKET_IO_REQUEST_ID,
        eventName: 'chat message',
        ack: true,
        args: [{ id: 'arg1', value: '"world"', mode: 'application/json' }],
      });
      expect(payload).toHaveProperty('_type', 'socketio_payload');
    });

    // `importResourcesToNewWorkspace` keys its id map by `_id`, so payloads sharing one literal
    // placeholder would collapse into a single document. Hand-written YAML may well omit
    // `body.meta`, which is what puts them on that placeholder path.
    it('gives bodies without a meta id distinct payload ids', async () => {
      const yaml = `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: No Body Meta
meta:
  id: wrk_no_body_meta
collection:
  - url: https://socket.example.com
    name: First
    meta:
      id: socketio-req_first
    body:
      eventName: first
      args:
        - id: arg1
          value: '"a"'
  - url: https://socket.example.com
    name: Second
    meta:
      id: socketio-req_second
    body:
      eventName: second
      args:
        - id: arg2
          value: '"b"'
`;

      const payloads = importInsomniaV5Data(yaml).filter(resource => resource.type === 'SocketIOPayload');

      expect(payloads).toHaveLength(2);
      expect(payloads[0]._id).not.toBe(payloads[1]._id);
      expect(payloads[0].parentId).not.toBe(payloads[1].parentId);
    });

    // Git Sync writes imported documents to the database verbatim, so a generated payload id has
    // to survive the export that validates it. A non-conforming one throws inside
    // `InsomniaFileSchema.parse`, which empties the export — and an empty export is skipped by
    // every flush site, silently stopping db-to-fs sync for the whole workspace.
    it('re-exports a body that arrived without a body.meta', async () => {
      const yaml = `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: Payload Workspace
meta:
  id: ${WORKSPACE_ID}
collection:
  - url: https://socket.example.com
    name: socketio-request
    meta:
      id: ${SOCKET_IO_REQUEST_ID}
    body:
      eventName: chat message
      args:
        - id: arg1
          value: '"world"'
  - url: wss://echo.example.com
    name: websocket-request
    meta:
      id: ${WEBSOCKET_REQUEST_ID}
    body:
      value: '{"ping":1}'
`;

      for (const doc of importInsomniaV5Data(yaml)) {
        await db.update(doc);
      }

      const reExported = await exportWorkspace();

      expect(reExported).not.toBe('');
      expect(findNode(reExported, 'socketio-request').body).toMatchObject({ eventName: 'chat message' });
      expect(findNode(reExported, 'websocket-request').body).toMatchObject({ value: '{"ping":1}' });
    });

    // The union guards keep the two realtime types apart inside `RequestCollectionSchema`, but
    // `walkCollection` routes with the base schemas, so this has to be asserted end to end
    it('keeps a Socket.IO item without meta on the Socket.IO branch', () => {
      const yaml = `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: No Meta
meta:
  id: wrk_no_meta
collection:
  - url: https://socket.example.com
    name: Rooms
    eventListeners:
      - id: ev1
        eventName: joined
    body:
      eventName: chat message
      ack: true
      args:
        - id: arg1
          value: '"world"'
`;

      const resources = importInsomniaV5Data(yaml);

      expect(resources.map(resource => resource.type)).toEqual(
        expect.arrayContaining(['SocketIORequest', 'SocketIOPayload']),
      );
      expect(resources.map(resource => resource.type)).not.toContain('WebSocketPayload');
      expect(resources.find(resource => resource.type === 'SocketIOPayload')).toMatchObject({
        eventName: 'chat message',
        ack: true,
      });
    });
  });

  // The three calls the Duplicate Collection action makes, in order
  it('preserves payloads when a collection is duplicated (INS-3123)', async () => {
    await createSocketIORequest();
    await services.socketIOPayload.create({
      parentId: SOCKET_IO_REQUEST_ID,
      eventName: 'hello',
      args: [{ id: 'arg1', value: '"world"', mode: 'application/json' }],
    });
    await services.webSocketRequest.create({
      _id: WEBSOCKET_REQUEST_ID,
      name: 'websocket-request',
      parentId: WORKSPACE_ID,
      url: 'wss://echo.example.com',
      metaSortKey: 2,
    });
    await services.webSocketPayload.create({
      parentId: WEBSOCKET_REQUEST_ID,
      value: '{"ping":1}',
      mode: 'application/json',
    });
    // An untouched request, which must stay empty in the copy
    await services.socketIORequest.create({
      _id: 'socketio-req_untouched',
      name: 'untouched',
      parentId: WORKSPACE_ID,
      url: 'https://socket.example.com',
      metaSortKey: 3,
    });
    await services.socketIOPayload.getOrCreateByParentId('socketio-req_untouched');

    const oldWorkspace = (await services.workspace.getById(WORKSPACE_ID)) as Workspace;
    const content = await exportWorkspace();
    const data = importInsomniaV5Data(content);

    const newWorkspace = await importResourcesToNewWorkspace({
      projectId: 'proj_payload',
      workspaceToImport: { ...oldWorkspace, name: 'Payload Workspace (Copy)' },
      resourceCacheItem: {
        resources: data,
        content: JSON.stringify(data),
        importer: { id: 'insomnia-v5', name: 'Insomnia v5 Importer', description: '' },
      },
    });

    const copiedRequests = await services.socketIORequest.findByParentId(newWorkspace._id);
    const copiedSocketIO = copiedRequests.find(request => request.name === 'socketio-request');
    const [copiedWebSocket] = await services.webSocketRequest.findByParentId(newWorkspace._id);

    expect(newWorkspace._id).not.toBe(WORKSPACE_ID);
    expect(copiedSocketIO?._id).not.toBe(SOCKET_IO_REQUEST_ID);

    await expect(services.socketIOPayload.getByParentId(copiedSocketIO!._id)).resolves.toMatchObject({
      eventName: 'hello',
      args: [{ id: 'arg1', value: '"world"', mode: 'application/json' }],
    });
    await expect(services.webSocketPayload.getByParentId(copiedWebSocket._id)).resolves.toMatchObject({
      value: '{"ping":1}',
      mode: 'application/json',
    });

    const copiedUntouched = copiedRequests.find(request => request.name === 'untouched');
    await expect(services.socketIOPayload.getByParentId(copiedUntouched!._id)).resolves.toBeUndefined();
  });
});
