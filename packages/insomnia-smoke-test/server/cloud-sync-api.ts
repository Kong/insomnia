import zlib from 'node:zlib';

import type { Application } from 'express';
import { json } from 'express';
import type { FieldNode, OperationDefinitionNode } from 'graphql';
import { parse } from 'graphql';
import forge from 'node-forge';

export interface AESMessage {
  iv: string;
  t: string;
  d: string;
  ad: string;
}

// copy from packages/insomnia/src/account/crypt.ts
export function encryptAESBuffer(jwkOrKey: string | JsonWebKey, buff: Buffer, additionalData = ''): AESMessage {
  const _b64UrlToHex = (s: string) => {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    // Node.js compatible base64 decoding using Buffer
    const decoded = Buffer.from(b64, 'base64').toString('binary');
    return forge.util.bytesToHex(decoded);
  };
  const rawKey = typeof jwkOrKey === 'string' ? jwkOrKey : _b64UrlToHex(jwkOrKey.k || '');
  const key = forge.util.hexToBytes(rawKey);
  const iv = forge.random.getBytesSync(12);
  const cipher = forge.cipher.createCipher('AES-GCM', key);
  cipher.start({
    additionalData,
    iv,
    tagLength: 128,
  });
  // @ts-expect-error -- TSCONVERSION needs to be converted to string
  cipher.update(forge.util.createBuffer(buff));
  cipher.finish();
  return {
    iv: forge.util.bytesToHex(iv),
    // @ts-expect-error -- TSCONVERSION needs to be converted to string
    t: forge.util.bytesToHex(cipher.mode.tag),
    ad: forge.util.bytesToHex(additionalData),
    // @ts-expect-error -- TSCONVERSION needs to be converted to string
    d: forge.util.bytesToHex(cipher.output),
  };
}

const teams = [
  {
    id: 'team_001',
    name: 'Test Team',
  },
];
// symmetric key is copied from test.ts
const symmetricKey = {
  alg: 'A256GCM',
  ext: true,
  k: 'w62OJNWF4G8iWA8ZrTpModiY8dICyHI7ko1vMLb877g=',
  key_ops: ['encrypt', 'decrypt'],
  kty: 'oct',
};

const encryptedSymmetricKey =
  '78c1314a7be673f117872c83b0b47b6f2c1dc36081cdabc5b738f172f1082ab077e9b275c20171c45234c73f82f4dec8f5952b5399b4b05d2f8451972788aea0db43d82bb1df7e835f4becc70b68a375ba227b1f6388ff428596614c4e2c09484a1e5c4e56a82e6196de7c04ef22d958118e6b1478e7aecad2217a62e963defdfa4e0763300b9f840cf5130e6503635f835548cba317cbd1f229280fba6a906e53b35544ff5189790a45de0fc8a6a457bac8349334de9275d31cae1369c6207170128aba3db21fccc92a6d857aa3f5bc6ecbc7c42cace3df5fe5406b78e950f57918cca8983e05b93b6e6ea7a815bb3b643d0b0d7e7bb67aba440cd29c06799a';

const cloudSyncProject = [
  {
    id: 'proj_5145140e072d4007a30bfa6630ddae70',
    name: 'Collection Project',
    rootDocumentId: 'wrk_a7132f924ba7451594ba64ec411c9e13',
    teams,
  },
  {
    id: 'proj_5145140e072d4007a30bfa6630ddae71',
    name: 'Environment Project',
    rootDocumentId: 'wrk_2068a8dfd6914c369073686bb92737ae',
    teams,
  },
  {
    id: 'proj_5145140e072d4007a30bfa6630ddae72',
    name: 'MCP Project',
    rootDocumentId: 'wrk_efab8e758b97459bab2659d8fdcf8627',
    teams,
  },
];

const commonSnapshotProps = {
  author: 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
  authorAccount: {
    email: 'insomnia-user@konghq.com',
    firstName: 'insomnia-user@konghq.com',
    lastName: '',
  },
  description: '',
};
const projectSnapshots: Record<string, any[]> = {
  // collection project snapshots
  proj_5145140e072d4007a30bfa6630ddae70: [
    {
      ...commonSnapshotProps,
      created: '2026-01-22T06:20:00.759Z',
      id: '5f0e82a5d2db062da379bf021fedae0c717fd603',
      name: 'Initial Snapshot',
      parent: '0000000000000000000000000000000000000000',
      state: [
        {
          blob: 'be076c5943e0d32b05efbbf215b4f9d2bb894a9c',
          key: 'wrk_a7132f924ba7451594ba64ec411c9e13',
          name: 'My Collection R1',
        },
        {
          blob: 'c50bc39ab29bb892df65bdbc97f23af84b9d1067',
          key: 'env_48cf48a4dc8a0984d07cb8dad01a01c5d604439c',
          name: 'Base Environment',
        },
        {
          blob: 'd78e5942f5508063ea484bb4b497f0ed446309c9',
          key: 'req_d11697e0652742e691374e380cdcd2b2',
          name: 'New Request',
        },
      ],
    },
    {
      ...commonSnapshotProps,
      created: '2026-01-22T09:20:00.759Z',
      id: '29cc2d8b653591ad1587fc189fbe4e9c7026ea85',
      name: 'Update request URL and body',
      parent: '5f0e82a5d2db062da379bf021fedae0c717fd603',
      state: [
        {
          blob: 'be076c5943e0d32b05efbbf215b4f9d2bb894a9c',
          key: 'wrk_a7132f924ba7451594ba64ec411c9e13',
          name: 'My Collection R1',
        },
        {
          blob: 'c50bc39ab29bb892df65bdbc97f23af84b9d1067',
          key: 'env_48cf48a4dc8a0984d07cb8dad01a01c5d604439c',
          name: 'Base Environment',
        },
        {
          blob: '1f8a8cd1da88d9abb4bfc1d6e662716d41705ace',
          key: 'req_d11697e0652742e691374e380cdcd2b2',
          name: 'New Request',
        },
      ],
    },
  ],
  // env project snapshots
  proj_5145140e072d4007a30bfa6630ddae71: [
    {
      ...commonSnapshotProps,
      created: '2026-01-22T06:20:00.759Z',
      id: '5f0e82a5d2db062da379bf021fedae0c717fd603',
      name: 'Initial Snapshot',
      parent: '0000000000000000000000000000000000000000',
      state: [
        {
          blob: '2588c9eeaf8c4129c5b33bbb9f77de04e8598c5e',
          key: 'wrk_2068a8dfd6914c369073686bb92737ae',
          name: 'My Environment',
        },
        {
          blob: 'bf6064229bdaeec3bf597329c640ca2a11fd4d72',
          key: 'env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be',
          name: 'Base Environment',
        },
      ],
    },
  ],
  // mcp project snapshots
  proj_5145140e072d4007a30bfa6630ddae72: [
    {
      ...commonSnapshotProps,
      created: '2026-01-22T06:20:00.759Z',
      id: '5f0e82a5d2db062da379bf021fedae0c717fd603',
      name: 'Initial Snapshot',
      parent: '0000000000000000000000000000000000000000',
      state: [
        {
          blob: 'a8252b458e8a1b5f3c214e5e7f944887a142ae72',
          key: 'wrk_efab8e758b97459bab2659d8fdcf8627',
          name: 'My MCP Client',
        },
        {
          blob: 'ee4579d33d3e25e3244ead2dca8c7b6e2e4f8dcf',
          key: 'env_0c042933878b85facb6c4e673b0166b256f37ad0',
          name: 'Base Environment',
        },
        {
          blob: '2f6a337993dcbcc164187f74e4278ca22c0ea065',
          key: 'mcp-req_18ee6d8bec7645ada7c4ac48d416bdb0',
          name: 'MCP request',
        },
      ],
    },
    {
      ...commonSnapshotProps,
      created: '2026-01-22T09:20:00.759Z',
      id: '29cc2d8b653591ad1587fc189fbe4e9c7026ea85',
      name: 'Update MCP url',
      parent: '5f0e82a5d2db062da379bf021fedae0c717fd603',
      state: [
        {
          blob: 'a8252b458e8a1b5f3c214e5e7f944887a142ae72',
          key: 'wrk_efab8e758b97459bab2659d8fdcf8627',
          name: 'My MCP Client',
        },
        {
          blob: 'ee4579d33d3e25e3244ead2dca8c7b6e2e4f8dcf',
          key: 'env_0c042933878b85facb6c4e673b0166b256f37ad0',
          name: 'Base Environment',
        },
        {
          blob: '379b74a13b742b573c16dda3ed38abde8cfdb0c3',
          key: 'mcp-req_18ee6d8bec7645ada7c4ac48d416bdb0',
          name: 'MCP request',
        },
      ],
    },
  ],
};
const environmentProjectNewCommitSnapshot = [
  {
    ...commonSnapshotProps,
    created: '2026-01-22T06:20:00.759Z',
    id: '5f0e82a5d2db062da379bf021fedae0c717fd603',
    name: 'Initial Snapshot',
    parent: '0000000000000000000000000000000000000000',
    state: [
      {
        blob: '2588c9eeaf8c4129c5b33bbb9f77de04e8598c5e',
        key: 'wrk_2068a8dfd6914c369073686bb92737ae',
        name: 'My Environment',
      },
      {
        blob: 'bf6064229bdaeec3bf597329c640ca2a11fd4d72',
        key: 'env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be',
        name: 'Base Environment',
      },
    ],
  },
  {
    ...commonSnapshotProps,
    created: '2026-01-22T06:20:00.759Z',
    id: '29cc2d8b653591ad1587fc189fbe4e9c7026ea85',
    name: 'Update key value pair',
    parent: '5f0e82a5d2db062da379bf021fedae0c717fd603',
    state: [
      {
        blob: '2588c9eeaf8c4129c5b33bbb9f77de04e8598c5e',
        key: 'wrk_2068a8dfd6914c369073686bb92737ae',
        name: 'My Environment',
      },
      {
        blob: '966ed58bb00e1031ddd69afc171c34cbfde2b307',
        key: 'env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be',
        name: 'Base Environment',
      },
    ],
  },
];
const newSnapshots: Record<string, any[]> = {};
const newBlobs: Record<string, string> = {};
const rawBlobs: Record<string, string> = {
  // request collection blobs
  'be076c5943e0d32b05efbbf215b4f9d2bb894a9c':
    '{"_id":"wrk_a7132f924ba7451594ba64ec411c9e13","created":1769407477819,"description":"","name":"My Collection R1","parentId":null,"scope":"collection","type":"Workspace"}',
  'c50bc39ab29bb892df65bdbc97f23af84b9d1067':
    '{"_id":"env_48cf48a4dc8a0984d07cb8dad01a01c5d604439c","color":null,"created":1769407477820,"data":{},"dataPropertyOrder":null,"environmentType":"kv","isPrivate":false,"metaSortKey":1769407477820,"name":"Base Environment","parentId":"wrk_a7132f924ba7451594ba64ec411c9e13","type":"Environment"}',
  'd78e5942f5508063ea484bb4b497f0ed446309c9':
    '{"_id":"req_d11697e0652742e691374e380cdcd2b2","authentication":{},"body":{},"created":1769407553323,"description":"","headers":[{"name":"Content-Type","value":"application/json"},{"description":"","disabled":false,"name":"User-Agent","value":"insomnia/12.3.0"}],"isPrivate":false,"metaSortKey":-1769407553323,"method":"GET","name":"New Request","parameters":[],"parentId":"wrk_a7132f924ba7451594ba64ec411c9e13","pathParameters":[],"settingDisableRenderRequestBody":false,"settingEncodeUrl":true,"settingFollowRedirects":"global","settingRebuildPath":true,"settingSendCookies":true,"settingStoreCookies":true,"type":"Request","url":""}',
  '1f8a8cd1da88d9abb4bfc1d6e662716d41705ace':
    '{"_id":"req_d11697e0652742e691374e380cdcd2b2","authentication":{},"body":{"mimeType":"text/plain","text":"foo=bar"},"created":1769407553323,"description":"","headers":[{"name":"Content-Type","value":"application/json"},{"description":"","disabled":false,"name":"User-Agent","value":"insomnia/12.3.0"}],"isPrivate":false,"metaSortKey":-1769407553323,"method":"GET","name":"New Request","parameters":[],"parentId":"wrk_a7132f924ba7451594ba64ec411c9e13","pathParameters":[],"settingDisableRenderRequestBody":false,"settingEncodeUrl":true,"settingFollowRedirects":"global","settingRebuildPath":true,"settingSendCookies":true,"settingStoreCookies":true,"type":"Request","url":"localhost:4010/echo"}',
  // environment blobs
  '2588c9eeaf8c4129c5b33bbb9f77de04e8598c5e':
    '{"_id":"wrk_2068a8dfd6914c369073686bb92737ae","created":1769408109261,"description":"","name":"My Environment","parentId":null,"scope":"environment","type":"Workspace"}',
  'bf6064229bdaeec3bf597329c640ca2a11fd4d72':
    '{"_id":"env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be","color":null,"created":1769408109277,"data":{},"dataPropertyOrder":null,"environmentType":"kv","isPrivate":false,"metaSortKey":1769408109277,"name":"Base Environment","parentId":"wrk_2068a8dfd6914c369073686bb92737ae","type":"Environment"}',
  '966ed58bb00e1031ddd69afc171c34cbfde2b307':
    '{"_id":"env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be","color":null,"created":1769408109277,"data":{"foo":"bar"},"dataPropertyOrder":null,"environmentType":"kv","isPrivate":false,"kvPairData":[{"enabled":true,"id":"envPair_6691b0028e104e499f8c4acf0a1a9e6a","name":"foo","type":"str","value":"bar"}],"metaSortKey":1769408109277,"name":"Base Environment","parentId":"wrk_2068a8dfd6914c369073686bb92737ae","type":"Environment"}',
  // mcp blobs
  'a8252b458e8a1b5f3c214e5e7f944887a142ae72':
    '{"_id":"wrk_efab8e758b97459bab2659d8fdcf8627","created":1769408435321,"description":"","name":"My MCP Client","parentId":null,"scope":"mcp","type":"Workspace"}',
  'ee4579d33d3e25e3244ead2dca8c7b6e2e4f8dcf':
    '{"_id":"env_0c042933878b85facb6c4e673b0166b256f37ad0","color":null,"created":1769408435351,"data":{},"dataPropertyOrder":null,"environmentType":"kv","isPrivate":false,"metaSortKey":1769408435351,"name":"Base Environment","parentId":"wrk_efab8e758b97459bab2659d8fdcf8627","type":"Environment"}',
  '2f6a337993dcbcc164187f74e4278ca22c0ea065':
    '{"_id":"mcp-req_18ee6d8bec7645ada7c4ac48d416bdb0","authentication":{},"connected":false,"created":1769408435331,"description":"","env":[],"headers":[{"name":"User-Agent","value":"insomnia/12.3.0"}],"mcpStdioAccess":false,"parentId":"wrk_efab8e758b97459bab2659d8fdcf8627","roots":[],"sslValidation":true,"subscribeResources":[],"transportType":"streamable-http","type":"McpRequest","url":""}',
  '379b74a13b742b573c16dda3ed38abde8cfdb0c3':
    '{"_id":"mcp-req_18ee6d8bec7645ada7c4ac48d416bdb0","authentication":{},"connected":false,"created":1769408435331,"description":"","env":[],"headers":[{"name":"User-Agent","value":"insomnia/12.3.0"}],"mcpStdioAccess":false,"parentId":"wrk_efab8e758b97459bab2659d8fdcf8627","roots":[],"sslValidation":true,"subscribeResources":[],"transportType":"streamable-http","type":"McpRequest","url":"http://localhost:4010/mcp"}',
};
const defaultBranches = [{ name: 'master' }, { name: 'develop' }];
let deletedProjectIds: string[] = [];
let cloudSyncApiEnabled = false;
let remoteHasNewCommit = false;

const getSnapshotsForProject = (projectId: string) => {
  const originalSnapshots = projectSnapshots[projectId] || [];
  const addedSnapshots = newSnapshots[projectId] || [];
  if (projectId === 'proj_5145140e072d4007a30bfa6630ddae71' && remoteHasNewCommit) {
    return environmentProjectNewCommitSnapshot;
  }
  return [...originalSnapshots, ...addedSnapshots];
};

export default function setup(app: Application) {
  app.post('/__test-config/cloud-sync', json(), (req, res) => {
    const { enabled = false } = req.body ?? {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean value' });
    }
    cloudSyncApiEnabled = enabled;
    if (!enabled) {
      // clear the test data when cloud sync is disabled to avoid affecting other tests
      deletedProjectIds = [];
      remoteHasNewCommit = false;
    }
    return res.status(200).send();
  });

  app.post('/__test-config/cloud-sync/new-commit', json(), (req, res) => {
    const { enabled = false } = req.body ?? {};
    remoteHasNewCommit = !!enabled;
    return res.status(200).send();
  });

  // handling response for all graphql requests
  app.post('/graphql', json(), (req, res) => {
    if (!cloudSyncApiEnabled) {
      return res.status(200).send();
    }
    const { query, variables } = req.body;

    try {
      // Parse the GraphQL query using the graphql package
      const document = parse(query);
      const operation = document.definitions[0] as OperationDefinitionNode;
      const operationType = operation.operation; // 'query' or 'mutation'

      // Extract the field name (the main operation being requested)
      const selectionSet = operation.selectionSet.selections;
      const fieldNode = selectionSet[0] as FieldNode;
      const operationName = fieldNode.name.value;

      console.log(`[GraphQL] ${operationType}: ${operationName}`, variables);

      // Handle queries
      if (operationType === 'query') {
        switch (operationName) {
          case 'branches': {
            return res.status(200).json({
              data: {
                branches: defaultBranches,
              },
            });
          }

          case 'branch': {
            const projectId = variables.projectId;
            const projectBranch = variables.branch;
            const snapshots = getSnapshotsForProject(projectId);
            if (projectId && snapshots.length > 0) {
              return res.status(200).json({
                data: {
                  branch: {
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    name: projectBranch || 'master',
                    snapshots: snapshots.map(s => s.id),
                  },
                },
              });
            }
            return res.status(200).json({
              data: {
                branch: {
                  created: new Date().toISOString(),
                  modified: new Date().toISOString(),
                  name: projectBranch || 'master',
                  snapshots: ['snap_001'],
                },
              },
            });
          }

          case 'snapshots': {
            const projectId = variables.projectId;
            if (projectId) {
              const allSnapshots = getSnapshotsForProject(projectId);
              return res.status(200).json({
                data: {
                  snapshots: allSnapshots,
                },
              });
            }
            const snapshots = (variables.ids || []).map((id: string) => ({
              id,
              parent: 'parent_' + id,
              created: new Date().toISOString(),
              author: 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
              authorAccount: {
                firstName: 'insomnia',
                lastName: 'user',
                email: 'insomnia-user@konghq.com',
              },
              name: `Snapshot ${id}`,
              description: 'Test snapshot',
              state: [],
            }));

            return res.status(200).json({
              data: { snapshots },
            });
          }

          case 'blobs': {
            const blobIds = variables.ids || [];
            const blobs: { content: string; id: string }[] = [];
            blobIds.forEach((id: string) => {
              const content = rawBlobs[id] || newBlobs[id];
              if (content) {
                const rawContent = Buffer.from(content, 'utf8');
                const zippedContent = zlib.gzipSync(rawContent);
                const encryptedResult = encryptAESBuffer(symmetricKey, zippedContent);
                blobs.push({ id, content: JSON.stringify(encryptedResult, null, 2) });
              }
            });

            return res.status(200).json({
              data: { blobs },
            });
          }

          case 'blobsMissing': {
            const blobIds = variables.ids || [];
            const missing = blobIds.filter((id: string) => !rawBlobs[id] && !newBlobs[id]);
            return res.status(200).json({
              data: {
                blobsMissing: {
                  missing,
                },
              },
            });
          }

          case 'projectKey': {
            return res.status(200).json({
              data: {
                projectKey: {
                  encSymmetricKey: encryptedSymmetricKey,
                },
              },
            });
          }

          // query project
          case 'project': {
            const projectId = variables.id;
            const project = cloudSyncProject.find(p => p.id === projectId);
            if (project) {
              return res.status(200).json({
                data: {
                  project: {
                    id: projectId,
                    name: project.name,
                    rootDocumentId: project?.rootDocumentId,
                  },
                },
              });
            }
            return res.status(404).json({
              data: {
                project: null,
              },
            });
          }

          case 'projects': {
            return res.status(200).json({
              data: {
                projects: cloudSyncProject.filter(p => !deletedProjectIds.includes(p.id)),
              },
            });
          }

          case 'teamMemberKeys': {
            return res.status(200).json({
              data: {
                teamMemberKeys: {
                  memberKeys: [
                    {
                      accountId: 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
                      publicKey: JSON.stringify({
                        alg: 'RSA-OAEP-256',
                        e: 'AQAB',
                        ext: true,
                        key_ops: ['encrypt'],
                        kty: 'RSA',
                        n: 'pTQVaUaiqggIldSKm6ib6eFRLLoGj9W-2O4gTbiorR-2b8-ZmKUwQ0F-jgYX71AjYaFn5VjOHOHSP6byNAjN7WzJ6A_Z3tytNraLoZfwK8KdfflOCZiZzQeD3nO8BNgh_zEgCHStU61b6N6bSpCKjbyPkmZcOkJfsz0LJMAxrXvFB-I42WYA2vJKReTJKXeYx4d6L_XGNIoYtmGZit8FldT4AucfQUXgdlKvr4_OZmt6hgjwt_Pjcu-_jO7m589mMWMebfUhjte3Lp1jps0MqTOvgRb0FQf5eoBHnL01OZjvFPDKeqlvoz7II9wFNHIKzSvgAKnyemh6DiyPuIukyQ',
                      }),
                      autoLinked: false,
                    },
                  ],
                },
              },
            });
          }

          default: {
            console.warn(`[GraphQL] Unhandled query: ${operationName}`);
            return res.status(200).json({
              data: null,
              errors: [{ message: `Unhandled query: ${operationName}` }],
            });
          }
        }
      }

      // Handle mutations
      if (operationType === 'mutation') {
        switch (operationName) {
          // delete project
          case 'projectArchive': {
            const projectId = variables.id;
            if (!deletedProjectIds.includes(projectId)) {
              deletedProjectIds.push(projectId);
            }
            return res.status(200).json({
              data: {
                projectArchive: true,
              },
            });
          }

          // delete branch
          case 'branchRemove': {
            return res.status(200).json({
              data: {
                branchRemove: true,
              },
            });
          }

          case 'snapshotsCreate': {
            const projectId = variables.projectId;
            const snapshots = variables.snapshots || [];
            if (snapshots.length > 0 && !newSnapshots[projectId]) {
              newSnapshots[projectId] = [];
            }
            newSnapshots[projectId].push(...snapshots);
            return res.status(200).json({
              data: { snapshotsCreate: snapshots },
            });
          }

          case 'blobsCreate': {
            const blobs = variables.blobs || [];
            blobs.forEach((blob: { id: string; content: string }) => {
              newBlobs[blob.id] = blob.content;
            });
            return res.status(200).json({
              data: {
                blobsCreate: {
                  count: (variables.blobs || []).length,
                },
              },
            });
          }

          case 'projectCreate': {
            return res.status(200).json({
              data: {
                projectCreate: {
                  id: variables.id || 'proj_' + Date.now(),
                  name: variables.name || 'New Project',
                  rootDocumentId: variables.rootDocumentId || 'wrk_' + Date.now(),
                },
              },
            });
          }

          default: {
            console.warn(`[GraphQL] Unhandled mutation: ${operationName}`);
            return res.status(200).json({
              data: null,
              errors: [{ message: `Unhandled mutation: ${operationName}` }],
            });
          }
        }
      }

      // Fallback for unknown operation types
      console.warn('[GraphQL] Unknown operation type:', operationType);
      return res.status(200).json({
        data: null,
        errors: [{ message: 'Unknown operation type' }],
      });
    } catch (error) {
      console.error('[GraphQL] Parse error:', error);
      return res.status(400).json({
        data: null,
        errors: [{ message: 'GraphQL parse error: ' + (error as Error).message }],
      });
    }
  });
}
