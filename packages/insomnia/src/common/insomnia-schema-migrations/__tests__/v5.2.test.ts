/**
 * Tests for Insomnia Schema Migrations - v5.2
 *
 * Verifies that `addCollectionItemTypeTags` correctly infers and adds an explicit
 * `type` field to every request/folder in `data.collection`, recursively through
 * nested folders, using the same structural signals the exporter has always written
 * per type (id prefix, method, url, children, protoFileId/metadata/reflectionApi,
 * eventListeners).
 */

import { describe, expect, it } from 'vitest';

import { addCollectionItemTypeFields } from '../v5.2';

describe('Insomnia Schema Migrations - v5.2', () => {
  describe('addCollectionItemTypeFields', () => {
    it('tags a plain HTTP request via its method field', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'Get Users',
            url: 'https://api.example.com/users',
            method: 'GET',
            meta: { id: 'req_abc123' },
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('Request');
    });

    it('tags a request via its id prefix when method is absent', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'Legacy Request',
            url: 'https://api.example.com/legacy',
            meta: { id: 'req_legacy1' },
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('Request');
    });

    it('tags a folder (request group) via its children field', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'My Folder',
            meta: { id: 'fld_folder1' },
            children: [],
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('RequestGroup');
    });

    it('tags a folder via its id prefix when it has no url and no children', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'Empty Folder',
            meta: { id: 'fld_empty1' },
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('RequestGroup');
    });

    it('tags a gRPC request via its protoFileId field', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'My gRPC Call',
            meta: { id: 'greq_call1' },
            protoFileId: 'pf_proto1',
            reflectionApi: { enabled: false },
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('GrpcRequest');
    });

    it('tags a gRPC request via its metadata field', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'My gRPC Call',
            meta: { id: 'greq_call2' },
            metadata: [{ name: 'auth', value: 'token' }],
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('GrpcRequest');
    });

    it('tags a gRPC request via its id prefix', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'My gRPC Call',
            meta: { id: 'greq_call3' },
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('GrpcRequest');
    });

    it('tags a Socket.IO request via its eventListeners field', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'My Socket.IO Request',
            url: 'https://api.example.com/socket',
            meta: { id: 'socketio-req_sio1' },
            eventListeners: [{ id: 'evt1', eventName: 'message' }],
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('SocketIORequest');
    });

    it('tags a Socket.IO request via its id prefix', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'My Socket.IO Request',
            url: 'https://api.example.com/socket',
            meta: { id: 'socketio-req_sio2' },
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('SocketIORequest');
    });

    it('tags a WebSocket request via its id prefix when there is no method', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'My WebSocket Request',
            url: 'wss://api.example.com/ws',
            meta: { id: 'ws-req_wsr1' },
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('WebSocketRequest');
    });

    it('recursively tags nested children inside folders', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          {
            name: 'Parent Folder',
            meta: { id: 'fld_parent1' },
            children: [
              {
                name: 'Nested Request',
                url: 'https://api.example.com/nested',
                method: 'POST',
                meta: { id: 'req_nested1' },
              },
              {
                name: 'Nested Folder',
                meta: { id: 'fld_nested1' },
                children: [
                  {
                    name: 'Deeply Nested Request',
                    url: 'https://api.example.com/deep',
                    method: 'PUT',
                    meta: { id: 'req_deep1' },
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      const parent = result.collection[0];
      expect(parent.type).toBe('RequestGroup');

      const [nestedRequest, nestedFolder] = parent.children;
      expect(nestedRequest.type).toBe('Request');
      expect(nestedFolder.type).toBe('RequestGroup');
      expect(nestedFolder.children[0].type).toBe('Request');
    });

    it('tags every item across a mixed collection', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: [
          { name: 'Req', url: 'https://a.com', method: 'GET', meta: { id: 'req_1' } },
          { name: 'Folder', meta: { id: 'fld_1' }, children: [] },
          { name: 'Grpc', meta: { id: 'greq_1' }, protoFileId: 'pf_1' },
          { name: 'Socket', meta: { id: 'socketio-req_1' }, eventListeners: [] },
          { name: 'Ws', url: 'wss://a.com', meta: { id: 'ws-req_1' } },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection.map((item: any) => item.type)).toEqual([
        'Request',
        'RequestGroup',
        'GrpcRequest',
        'SocketIORequest',
        'WebSocketRequest',
      ]);
    });

    it('also tags collections on spec.insomnia.rest/5.0 files', () => {
      const data: any = {
        type: 'spec.insomnia.rest/5.0',
        collection: [
          {
            name: 'Spec Request',
            url: 'https://api.example.com/spec',
            method: 'GET',
            meta: { id: 'req_spec1' },
          },
        ],
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection[0].type).toBe('Request');
    });

    it('leaves files without a collection array untouched', () => {
      const data: any = {
        type: 'environment.insomnia.rest/5.0',
        name: 'Base Environment',
        environments: { data: { key: 'value' } },
      };

      const result = addCollectionItemTypeFields(data);

      expect(result).toEqual(data);
    });

    it('leaves data with no type field untouched', () => {
      const data: any = { name: 'Untyped' };

      const result = addCollectionItemTypeFields(data);

      expect(result).toEqual(data);
    });

    it('passes through null/non-object input unchanged', () => {
      expect(addCollectionItemTypeFields(null as any)).toBeNull();
      expect(addCollectionItemTypeFields(undefined as any)).toBeUndefined();
    });

    it('leaves a collection.insomnia.rest/5.0 file with a non-array collection untouched', () => {
      const data: any = {
        type: 'collection.insomnia.rest/5.0',
        collection: undefined,
      };

      const result = addCollectionItemTypeFields(data);

      expect(result.collection).toBeUndefined();
    });
  });
});
