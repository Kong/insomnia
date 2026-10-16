#!/usr/bin/env node
"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { parse } = require("graphql");

const ACCOUNT_ID = "acct_64a477e6b59d43a5a607f84b4f73e3ce";
const ORG_ID = "org_7ef19d06-5a24-47ca-bc81-3dea011edec2";
const PROJECT_ID = "proj_org_7ef19d06-5a24-47ca-bc81-3dea011edec2";

// Feature-flag / storage-rule state, isolated per Electron instance via the
// `x-session-id` header every request carries (sourced from
// misc/fixtures.ts's INSOMNIA_SESSION.id, unique per Playwright worker slot).
// Without this, one spec file's beforeAll toggling a flag would leak into
// every other worker's concurrently-running Electron instance, since this
// mock-api.js process is shared by all of them. The `_admin/features/*` PUTs
// below run *before* the Electron instance they're meant for has launched,
// so they can't rely on a header — misc/fixtures.ts passes `sessionId`
// explicitly in the body instead.
const DEFAULT_FEATURE_STATE = {
  gitSyncEnabled: true,
  gitSyncStorageRuleEnabled: true,
  konnectEntitlementEnabled: false,
};
const featureStateBySession = new Map(); // sessionId -> partial DEFAULT_FEATURE_STATE overrides

function getFeatureState(sessionId) {
  return { ...DEFAULT_FEATURE_STATE, ...featureStateBySession.get(sessionId) };
}

function setFeatureState(sessionId, patch) {
  featureStateBySession.set(sessionId, { ...getFeatureState(sessionId), ...patch });
}

// Cloud Sync (VCS) mock — a GraphQL API at POST /graphql, the same base URL
// (INSOMNIA_API_URL) the app already uses for every REST route above. Ported
// from insomnia-smoke-test's server/cloud-sync-api.ts: same account/org ids
// and the same symmetricKey misc/fixtures.ts's INSOMNIA_SESSION already
// injects, so the client can decrypt blobs with no real key exchange.
// Test-only credentials, generated fresh every time this process starts so no
// key material is committed to the repo. misc/launch.ts fetches them from
// GET /_admin/session-keys before each Electron launch and injects them as
// INSOMNIA_SESSION, so the app and this mock always agree on the same keys.
const CLOUD_SYNC_SYMMETRIC_KEY = {
  alg: "A256GCM",
  ext: true,
  // Padded base64url, matching the format the app's own session JWK uses.
  k: `${crypto.randomBytes(32).toString("base64url")}=`,
  key_ops: ["encrypt", "decrypt"],
  kty: "oct",
};

function cloudSyncKeyBuf(jwk) {
  return Buffer.from(jwk.k, "base64url");
}

function decryptCloudSyncBlob(msg) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    cloudSyncKeyBuf(CLOUD_SYNC_SYMMETRIC_KEY),
    Buffer.from(msg.iv, "hex"),
    { authTagLength: 16 },
  );
  decipher.setAuthTag(Buffer.from(msg.t, "hex"));
  if (msg.ad) decipher.setAAD(Buffer.from(msg.ad, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(msg.d, "hex")),
    decipher.final(),
  ]);
}

function encryptCloudSyncBlob(buf) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    cloudSyncKeyBuf(CLOUD_SYNC_SYMMETRIC_KEY),
    iv,
  );
  const d = Buffer.concat([cipher.update(buf), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    t: cipher.getAuthTag().toString("hex"),
    ad: "",
    d: d.toString("hex"),
  };
}


// A single self-consistent keypair: `enc_private_key` (AES-GCM under
// CLOUD_SYNC_SYMMETRIC_KEY) and CLOUD_SYNC_ENCRYPTED_SYMMETRIC_KEY (RSA-OAEP-
// 256 under the public key) must both round-trip through the app's real
// decryptAES / decryptRSAWithJWK. Plaintexts are URL-encoded JSON, the same
// convention as encryptAES / encryptRSAWithJWK in insomnia-vcs's crypt.ts.
const { publicKey: RSA_PUBLIC_KEY, privateKey: RSA_PRIVATE_KEY } =
  crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicExponent: 65_537,
  });
const PUBLIC_KEY_N = RSA_PUBLIC_KEY.export({ format: "jwk" }).n;
const ENC_PRIVATE_KEY = encryptCloudSyncBlob(
  Buffer.from(
    encodeURIComponent(JSON.stringify(RSA_PRIVATE_KEY.export({ format: "jwk" }))),
  ),
);
// AES-GCM of the symmetric-key JWK, served as `enc_symmetric_key`.
const ENC_SYMMETRIC_KEY = encryptCloudSyncBlob(
  Buffer.from(encodeURIComponent(JSON.stringify(CLOUD_SYNC_SYMMETRIC_KEY))),
);
// RSA-OAEP-256 caps the plaintext at 190 bytes for a 2048-bit key, so `k` is
// unpadded here to fit.
const CLOUD_SYNC_ENCRYPTED_SYMMETRIC_KEY = crypto
  .publicEncrypt(
    {
      key: RSA_PUBLIC_KEY,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(
      encodeURIComponent(
        JSON.stringify({
          ...CLOUD_SYNC_SYMMETRIC_KEY,
          k: CLOUD_SYNC_SYMMETRIC_KEY.k.replace(/=+$/, ""),
        }),
      ),
    ),
  )
  .toString("hex");

const CLOUD_SYNC_TEAMS = [{ id: "team_001", name: "Test Team" }];

const cloudSyncProjects = [
  {
    id: "proj_5145140e072d4007a30bfa6630ddae70",
    name: "My Collection R1",
    rootDocumentId: "wrk_a7132f924ba7451594ba64ec411c9e13",
    teamProjectId: PROJECT_ID,
    teams: CLOUD_SYNC_TEAMS,
  },
  {
    id: "proj_5145140e072d4007a30bfa6630ddae71",
    name: "My Environment",
    rootDocumentId: "wrk_2068a8dfd6914c369073686bb92737ae",
    teamProjectId: PROJECT_ID,
    teams: CLOUD_SYNC_TEAMS,
  },
  {
    id: "proj_5145140e072d4007a30bfa6630ddae72",
    name: "My MCP Client",
    rootDocumentId: "wrk_efab8e758b97459bab2659d8fdcf8627",
    teamProjectId: PROJECT_ID,
    teams: CLOUD_SYNC_TEAMS,
  },
  // A pre-existing INS-2026-style "ghost" backend project (case 5 in the
  // Cloud Sync Cross-Workspace Commit Misalignment Fix test plan): its own
  // `rootDocumentId` never matches the single `wrk_*` key inside its own
  // latest snapshot's `state[]` — the exact invariant violation the bug
  // produces — and it's never pulled locally, so it always renders as an
  // `unsynced` dashboard card. Deleting it exercises the dashboard's
  // "archive by id, no repair" path without needing a second account or a
  // reproduced race.
  {
    id: "proj_5145140e072d4007a30bfa6630ddae73",
    name: "Ghost Collection",
    rootDocumentId: "wrk_ghost00000000000000000000000000",
    teamProjectId: PROJECT_ID,
    teams: CLOUD_SYNC_TEAMS,
  },
];

const CLOUD_SYNC_SNAPSHOT_COMMON = {
  author: ACCOUNT_ID,
  authorAccount: {
    email: "insomnia-user@konghq.com",
    firstName: "insomnia-user@konghq.com",
    lastName: "",
  },
  description: "",
};

const cloudSyncProjectSnapshots = {
  // "My Collection R1"
  proj_5145140e072d4007a30bfa6630ddae70: [
    {
      ...CLOUD_SYNC_SNAPSHOT_COMMON,
      created: "2026-01-22T06:20:00.759Z",
      id: "5f0e82a5d2db062da379bf021fedae0c717fd603",
      name: "Initial Snapshot",
      parent: "0000000000000000000000000000000000000000",
      state: [
        {
          blob: "be076c5943e0d32b05efbbf215b4f9d2bb894a9c",
          key: "wrk_a7132f924ba7451594ba64ec411c9e13",
          name: "My Collection R1",
        },
        {
          blob: "1b7fe31ec583c8a42fedc0e86a103b94076e77c4",
          key: "env_48cf48a4dc8a0984d07cb8dad01a01c5d604439c",
          name: "Base Environment",
        },
        {
          blob: "d78e5942f5508063ea484bb4b497f0ed446309c9",
          key: "req_d11697e0652742e691374e380cdcd2b2",
          name: "New Request",
        },
      ],
    },
    {
      ...CLOUD_SYNC_SNAPSHOT_COMMON,
      created: "2026-01-22T09:20:00.759Z",
      id: "29cc2d8b653591ad1587fc189fbe4e9c7026ea85",
      name: "Update request URL and body",
      parent: "5f0e82a5d2db062da379bf021fedae0c717fd603",
      state: [
        {
          blob: "be076c5943e0d32b05efbbf215b4f9d2bb894a9c",
          key: "wrk_a7132f924ba7451594ba64ec411c9e13",
          name: "My Collection R1",
        },
        {
          blob: "1b7fe31ec583c8a42fedc0e86a103b94076e77c4",
          key: "env_48cf48a4dc8a0984d07cb8dad01a01c5d604439c",
          name: "Base Environment",
        },
        {
          blob: "1f8a8cd1da88d9abb4bfc1d6e662716d41705ace",
          key: "req_d11697e0652742e691374e380cdcd2b2",
          name: "New Request",
        },
      ],
    },
  ],
  // "My Environment"
  proj_5145140e072d4007a30bfa6630ddae71: [
    {
      ...CLOUD_SYNC_SNAPSHOT_COMMON,
      created: "2026-01-22T06:20:00.759Z",
      id: "5f0e82a5d2db062da379bf021fedae0c717fd603",
      name: "Initial Snapshot",
      parent: "0000000000000000000000000000000000000000",
      state: [
        {
          blob: "2588c9eeaf8c4129c5b33bbb9f77de04e8598c5e",
          key: "wrk_2068a8dfd6914c369073686bb92737ae",
          name: "My Environment",
        },
        {
          blob: "7024cbb27bb92821c17c0b27de612a0b1a8c082c",
          key: "env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be",
          name: "Base Environment",
        },
      ],
    },
  ],
  // "My MCP Client"
  proj_5145140e072d4007a30bfa6630ddae72: [
    {
      ...CLOUD_SYNC_SNAPSHOT_COMMON,
      created: "2026-01-22T06:20:00.759Z",
      id: "5f0e82a5d2db062da379bf021fedae0c717fd603",
      name: "Initial Snapshot",
      parent: "0000000000000000000000000000000000000000",
      state: [
        {
          blob: "a8252b458e8a1b5f3c214e5e7f944887a142ae72",
          key: "wrk_efab8e758b97459bab2659d8fdcf8627",
          name: "My MCP Client",
        },
        {
          blob: "fed20333ca44d6d4aae729f210ce371ed31392a3",
          key: "env_0c042933878b85facb6c4e673b0166b256f37ad0",
          name: "Base Environment",
        },
        {
          blob: "2f6a337993dcbcc164187f74e4278ca22c0ea065",
          key: "mcp-req_18ee6d8bec7645ada7c4ac48d416bdb0",
          name: "MCP request",
        },
      ],
    },
    {
      ...CLOUD_SYNC_SNAPSHOT_COMMON,
      created: "2026-01-22T09:20:00.759Z",
      id: "29cc2d8b653591ad1587fc189fbe4e9c7026ea85",
      name: "Update MCP url",
      parent: "5f0e82a5d2db062da379bf021fedae0c717fd603",
      state: [
        {
          blob: "a8252b458e8a1b5f3c214e5e7f944887a142ae72",
          key: "wrk_efab8e758b97459bab2659d8fdcf8627",
          name: "My MCP Client",
        },
        {
          blob: "fed20333ca44d6d4aae729f210ce371ed31392a3",
          key: "env_0c042933878b85facb6c4e673b0166b256f37ad0",
          name: "Base Environment",
        },
        {
          blob: "379b74a13b742b573c16dda3ed38abde8cfdb0c3",
          key: "mcp-req_18ee6d8bec7645ada7c4ac48d416bdb0",
          name: "MCP request",
        },
      ],
    },
  ],
  // "Ghost Collection" — its one snapshot's `state[]` carries a `wrk_*`
  // key that is deliberately NOT this project's own `rootDocumentId`
  // above, simulating the cross-workspace commit misalignment bug's
  // end state.
  proj_5145140e072d4007a30bfa6630ddae73: [
    {
      ...CLOUD_SYNC_SNAPSHOT_COMMON,
      created: "2026-01-22T06:20:00.759Z",
      id: "5f0e82a5d2db062da379bf021fedae0c717fd699",
      name: "Corrupted commit",
      parent: "0000000000000000000000000000000000000000",
      state: [
        {
          blob: "ghost0c5943e0d32b05efbbf215b4f9d2bb894a9c",
          key: "wrk_mismatched1111111111111111111111111",
          name: "Someone Else's Workspace",
        },
      ],
    },
  ],
};

// Alternate history returned for the "My Environment" project once a test
// simulates a new remote commit via PUT /_admin/cloud-sync/new-commit.
const cloudSyncEnvironmentNewCommitSnapshots = [
  cloudSyncProjectSnapshots.proj_5145140e072d4007a30bfa6630ddae71[0],
  {
    ...CLOUD_SYNC_SNAPSHOT_COMMON,
    created: "2026-01-22T06:20:00.759Z",
    id: "29cc2d8b653591ad1587fc189fbe4e9c7026ea85",
    name: "Update key value pair",
    parent: "5f0e82a5d2db062da379bf021fedae0c717fd603",
    state: [
      {
        blob: "2588c9eeaf8c4129c5b33bbb9f77de04e8598c5e",
        key: "wrk_2068a8dfd6914c369073686bb92737ae",
        name: "My Environment",
      },
      {
        blob: "8928646f281ac14f6410aa29fa60b7060f6529d0",
        key: "env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be",
        name: "Base Environment",
      },
    ],
  },
];

// Same idea as `cloudSyncEnvironmentNewCommitSnapshots`, but for "My
// Collection R1" — lets a test simulate a new remote commit for a regular
// (scope: "collection") workspace instead of only the environment-scope one.
const cloudSyncCollectionNewCommitSnapshots = [
  cloudSyncProjectSnapshots.proj_5145140e072d4007a30bfa6630ddae70[0],
  cloudSyncProjectSnapshots.proj_5145140e072d4007a30bfa6630ddae70[1],
  {
    ...CLOUD_SYNC_SNAPSHOT_COMMON,
    created: "2026-01-22T12:20:00.759Z",
    id: "3a51d9f2a4bc16d9d0a67b1f9c1b6a3e8f21c760",
    name: "Update environment value",
    parent: "29cc2d8b653591ad1587fc189fbe4e9c7026ea85",
    state: [
      {
        blob: "be076c5943e0d32b05efbbf215b4f9d2bb894a9c",
        key: "wrk_a7132f924ba7451594ba64ec411c9e13",
        name: "My Collection R1",
      },
      {
        blob: "9c1e6a7b2d4f083a1c5e7b9d2f6a8c1e3b5d7f90",
        key: "env_48cf48a4dc8a0984d07cb8dad01a01c5d604439c",
        name: "Base Environment",
      },
      {
        blob: "1f8a8cd1da88d9abb4bfc1d6e662716d41705ace",
        key: "req_d11697e0652742e691374e380cdcd2b2",
        name: "New Request",
      },
    ],
  },
];

// Maps a project id to the alternate history it returns while
// `remoteHasNewCommit` is on and that project is the one selected via
// `/_admin/cloud-sync/new-commit`'s `projectId` — see `getCloudSyncState`'s
// `newCommitProjectId`.
const CLOUD_SYNC_NEW_COMMIT_SNAPSHOTS = {
  proj_5145140e072d4007a30bfa6630ddae70: cloudSyncCollectionNewCommitSnapshots,
  proj_5145140e072d4007a30bfa6630ddae71: cloudSyncEnvironmentNewCommitSnapshots,
};

const cloudSyncRawBlobs = {
  "be076c5943e0d32b05efbbf215b4f9d2bb894a9c":
    '{"_id":"wrk_a7132f924ba7451594ba64ec411c9e13","created":1769407477819,"description":"","name":"My Collection R1","parentId":null,"scope":"collection","type":"Workspace"}',
  "1b7fe31ec583c8a42fedc0e86a103b94076e77c4":
    '{"_id":"env_48cf48a4dc8a0984d07cb8dad01a01c5d604439c","color":null,"created":1769407477820,"data":{},"environmentType":"kv","isPrivate":false,"metaSortKey":1769407477820,"name":"Base Environment","parentId":"wrk_a7132f924ba7451594ba64ec411c9e13","type":"Environment"}',
  "d78e5942f5508063ea484bb4b497f0ed446309c9":
    '{"_id":"req_d11697e0652742e691374e380cdcd2b2","authentication":{},"body":{},"created":1769407553323,"description":"","headers":[{"name":"Content-Type","value":"application/json"},{"description":"","disabled":false,"name":"User-Agent","value":"insomnia/12.3.0"}],"isPrivate":false,"metaSortKey":-1769407553323,"method":"GET","name":"New Request","parameters":[],"parentId":"wrk_a7132f924ba7451594ba64ec411c9e13","pathParameters":[],"settingDisableRenderRequestBody":false,"settingEncodeUrl":true,"settingFollowRedirects":"global","settingRebuildPath":true,"settingSendCookies":true,"settingStoreCookies":true,"type":"Request","url":""}',
  "1f8a8cd1da88d9abb4bfc1d6e662716d41705ace":
    '{"_id":"req_d11697e0652742e691374e380cdcd2b2","authentication":{},"body":{"mimeType":"text/plain","text":"foo=bar"},"created":1769407553323,"description":"","headers":[{"name":"Content-Type","value":"application/json"},{"description":"","disabled":false,"name":"User-Agent","value":"insomnia/12.3.0"}],"isPrivate":false,"metaSortKey":-1769407553323,"method":"GET","name":"New Request","parameters":[],"parentId":"wrk_a7132f924ba7451594ba64ec411c9e13","pathParameters":[],"settingDisableRenderRequestBody":false,"settingEncodeUrl":true,"settingFollowRedirects":"global","settingRebuildPath":true,"settingSendCookies":true,"settingStoreCookies":true,"type":"Request","url":"localhost:4060/post"}',
  "2588c9eeaf8c4129c5b33bbb9f77de04e8598c5e":
    '{"_id":"wrk_2068a8dfd6914c369073686bb92737ae","created":1769408109261,"description":"","name":"My Environment","parentId":null,"scope":"environment","type":"Workspace"}',
  "7024cbb27bb92821c17c0b27de612a0b1a8c082c":
    '{"_id":"env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be","color":null,"created":1769408109277,"data":{},"environmentType":"kv","isPrivate":false,"metaSortKey":1769408109277,"name":"Base Environment","parentId":"wrk_2068a8dfd6914c369073686bb92737ae","type":"Environment"}',
  "8928646f281ac14f6410aa29fa60b7060f6529d0":
    '{"_id":"env_2c63ae5788b4ac6a289cfe3776c7b3fa9f1cd9be","color":null,"created":1769408109277,"data":{"foo":"bar"},"environmentType":"kv","isPrivate":false,"kvPairData":[{"enabled":true,"id":"envPair_6691b0028e104e499f8c4acf0a1a9e6a","name":"foo","type":"str","value":"bar"}],"metaSortKey":1769408109277,"name":"Base Environment","parentId":"wrk_2068a8dfd6914c369073686bb92737ae","type":"Environment"}',
  "a8252b458e8a1b5f3c214e5e7f944887a142ae72":
    '{"_id":"wrk_efab8e758b97459bab2659d8fdcf8627","created":1769408435321,"description":"","name":"My MCP Client","parentId":null,"scope":"mcp","type":"Workspace"}',
  "fed20333ca44d6d4aae729f210ce371ed31392a3":
    '{"_id":"env_0c042933878b85facb6c4e673b0166b256f37ad0","color":null,"created":1769408435351,"data":{},"environmentType":"kv","isPrivate":false,"metaSortKey":1769408435351,"name":"Base Environment","parentId":"wrk_efab8e758b97459bab2659d8fdcf8627","type":"Environment"}',
  "2f6a337993dcbcc164187f74e4278ca22c0ea065":
    '{"_id":"mcp-req_18ee6d8bec7645ada7c4ac48d416bdb0","authentication":{},"connected":false,"created":1769408435331,"description":"","env":[],"headers":[{"name":"User-Agent","value":"insomnia/12.3.0"}],"mcpStdioAccess":false,"parentId":"wrk_efab8e758b97459bab2659d8fdcf8627","roots":[],"sslValidation":true,"subscribeResources":[],"transportType":"streamable-http","type":"McpRequest","url":""}',
  "379b74a13b742b573c16dda3ed38abde8cfdb0c3":
    '{"_id":"mcp-req_18ee6d8bec7645ada7c4ac48d416bdb0","authentication":{},"connected":false,"created":1769408435331,"description":"","env":[],"headers":[{"name":"User-Agent","value":"insomnia/12.3.0"}],"mcpStdioAccess":false,"parentId":"wrk_efab8e758b97459bab2659d8fdcf8627","roots":[],"sslValidation":true,"subscribeResources":[],"transportType":"streamable-http","type":"McpRequest","url":"http://localhost:4020/mcp"}',
  "9c1e6a7b2d4f083a1c5e7b9d2f6a8c1e3b5d7f90":
    '{"_id":"env_48cf48a4dc8a0984d07cb8dad01a01c5d604439c","color":null,"created":1769407477820,"data":{"baz":"qux"},"environmentType":"kv","isPrivate":false,"kvPairData":[{"enabled":true,"id":"envPair_9c1e6a7b2d4f083a1c5e7b9d","name":"baz","type":"str","value":"qux"}],"metaSortKey":1769407477820,"name":"Base Environment","parentId":"wrk_a7132f924ba7451594ba64ec411c9e13","type":"Environment"}',
};
const CLOUD_SYNC_DEFAULT_BRANCHES = [{ name: "master" }, { name: "develop" }];

// Cloud Sync's mutable state (pushed commits/blobs, archived projects, the
// simulated-remote-commit flag) is isolated per `x-session-id` — the same
// header/scoping mechanism `featureStateBySession` above uses — so
// concurrently-running Electron instances (different Playwright workers, or
// even sequential test runs reusing a worker) each see their own private
// copy of "My Collection R1" and friends instead of racing to commit/push
// against one shared branch. Confirmed live: without this, two concurrent
// `commitAndPush()`s on the same project produce a genuine "Remote history
// conflict" — correct VCS behavior, but not what a same-fixture-per-test
// spec expects.
const cloudSyncStateBySession = new Map(); // sessionId -> { newSnapshots, newBlobs, deletedProjectIds, remoteHasNewCommit }

function getCloudSyncState(sessionId) {
  if (!cloudSyncStateBySession.has(sessionId)) {
    cloudSyncStateBySession.set(sessionId, {
      newSnapshots: {},
      newBlobs: {},
      newProjects: [],
      deletedProjectIds: [],
      remoteHasNewCommit: false,
      // Which project id `remoteHasNewCommit` applies to — see
      // `CLOUD_SYNC_NEW_COMMIT_SNAPSHOTS`. Defaults to "My Environment" for
      // back-compat with callers of `/_admin/cloud-sync/new-commit` that
      // don't pass `projectId`.
      newCommitProjectId: "proj_5145140e072d4007a30bfa6630ddae71",
      // Test-only concurrency knob (INS-2026): unlike the other mock servers'
      // `x-reply-delay-ms` header, the app's Cloud Sync GraphQL calls run in
      // the Electron main process, not the renderer, so a spec has no way to
      // attach a custom header to them. Set via `POST
      // /_admin/cloud-sync/delay` instead. Scoped to `delayProjectId` (not
      // every request for the session) — a workspace being created runs its
      // own `sync.invoke` calls on the very same session, e.g. a fresh
      // workspace under a remote project pushes itself immediately too, so
      // an unscoped delay would stall that unrelated push as well, and did
      // (confirmed live: a 6s delay ballooned "New Collection" to ~48s).
      delayMs: 0,
      delayProjectId: null,
      // Test-only request log (INS-2026): every Cloud Sync GraphQL request
      // this session makes, in arrival order, tagged with the project id it
      // actually carried. A spec can diff this against which workspace it
      // *expected* to be talking to at that point in the flow — e.g. after
      // stalling one workspace's pull and creating a sibling collection, do
      // the pull's resumed `snapshots`/`blobs` queries still carry the
      // stalled workspace's own id, or did they get redirected to the new
      // sibling's? That's the actual on-the-wire shape of a shared-VCS-
      // singleton regression — more direct than inferring it from which
      // project's on-disk files ended up with new content.
      requestLog: [],
      // Test-only failure knob (INS-2026 case 5): when true, the
      // `projectArchive` mutation returns a GraphQL error instead of
      // succeeding, simulating a failed dashboard delete (e.g. offline or
      // revoked access) without an actual network fault. Set via `POST
      // /_admin/cloud-sync/archive-failure`.
      archiveShouldFail: false,
    });
  }
  return cloudSyncStateBySession.get(sessionId);
}

function resetCloudSyncState(sessionId) {
  cloudSyncStateBySession.delete(sessionId);
}

function getCloudSyncSnapshotsForProject(projectId, sessionId) {
  const state = getCloudSyncState(sessionId);
  if (
    state.remoteHasNewCommit &&
    projectId === state.newCommitProjectId &&
    CLOUD_SYNC_NEW_COMMIT_SNAPSHOTS[projectId]
  ) {
    return CLOUD_SYNC_NEW_COMMIT_SNAPSHOTS[projectId];
  }
  return [
    ...(cloudSyncProjectSnapshots[projectId] ?? []),
    ...(state.newSnapshots[projectId] ?? []),
  ];
}

function graphqlOperation(query) {
  const document = parse(query);
  const operation = document.definitions[0];
  return {
    operationType: operation.operation,
    operationName: operation.selectionSet.selections[0].name.value,
  };
}

function handleCloudSyncGraphQL(req, res) {
  const sessionId = req.headers["x-session-id"];
  readJsonBody(req)
    .then(async ({ query, variables = {} }) => {
      const { operationType, operationName } = graphqlOperation(query);
      const state = getCloudSyncState(sessionId);
      const requestProjectId =
        variables.id ??
        variables.projectId ??
        variables.teamProjectId ??
        null;
      state.requestLog.push({
        operationName,
        projectId: requestProjectId,
        at: Date.now(),
      });

      if (state.delayMs > 0 && (
          state.delayProjectId === null ||
          requestProjectId === state.delayProjectId
        )) {
          await new Promise((resolve) => setTimeout(resolve, state.delayMs));
        }

      if (operationType === "query") {
        switch (operationName) {
          case "branches": {
            return sendJson(res, 200, {
              data: { branches: CLOUD_SYNC_DEFAULT_BRANCHES },
            });
          }
          case "branch": {
            const snapshots = getCloudSyncSnapshotsForProject(
              variables.projectId,
              sessionId,
            );
            return sendJson(res, 200, {
              data: {
                branch: {
                  created: new Date().toISOString(),
                  modified: new Date().toISOString(),
                  name: variables.branch || "master",
                  snapshots: snapshots.map((s) => s.id),
                },
              },
            });
          }
          case "snapshots": {
            return sendJson(res, 200, {
              data: {
                snapshots: getCloudSyncSnapshotsForProject(
                  variables.projectId,
                  sessionId,
                ),
              },
            });
          }
          case "blobs": {
            const blobs = [];
            for (const id of variables.ids ?? []) {
              const content = cloudSyncRawBlobs[id] ?? state.newBlobs[id];
              if (!content) continue;
              const zipped = zlib.gzipSync(Buffer.from(content, "utf8"));
              blobs.push({
                id,
                content: JSON.stringify(encryptCloudSyncBlob(zipped)),
              });
            }
            return sendJson(res, 200, { data: { blobs } });
          }
          case "blobsMissing": {
            return sendJson(res, 200, {
              data: {
                blobsMissing: {
                  missing: (variables.ids ?? []).filter(
                    (id) => !cloudSyncRawBlobs[id] && !state.newBlobs[id],
                  ),
                },
              },
            });
          }
          case "projectKey": {
            return sendJson(res, 200, {
              data: {
                projectKey: {
                  encSymmetricKey: CLOUD_SYNC_ENCRYPTED_SYMMETRIC_KEY,
                },
              },
            });
          }
          case "project": {
            const project = [...cloudSyncProjects, ...state.newProjects].find(
              (p) => p.id === variables.id,
            );
            if (!project) return sendJson(res, 200, { data: { project: null } });
            return sendJson(res, 200, {
              data: {
                project: {
                  id: project.id,
                  name: project.name,
                  rootDocumentId: project.rootDocumentId,
                },
              },
            });
          }
          case "projects": {
            return sendJson(res, 200, {
              data: {
                projects: [...cloudSyncProjects, ...state.newProjects].filter(
                  (p) => !state.deletedProjectIds.includes(p.id),
                ),
              },
            });
          }
          case "teamMemberKeys": {
            return sendJson(res, 200, {
              data: {
                teamMemberKeys: {
                  memberKeys: [
                    {
                      accountId: ACCOUNT_ID,
                      publicKey: JSON.stringify({
                        alg: "RSA-OAEP-256",
                        e: "AQAB",
                        ext: true,
                        key_ops: ["encrypt"],
                        kty: "RSA",
                        n: PUBLIC_KEY_N,
                      }),
                      autoLinked: false,
                    },
                  ],
                },
              },
            });
          }
          default: {
            return sendJson(res, 200, {
              data: null,
              errors: [{ message: `Unhandled query: ${operationName}` }],
            });
          }
        }
      }

      switch (operationName) {
        case "projectArchive": {
          if (state.archiveShouldFail) {
            return sendJson(res, 200, {
              data: null,
              errors: [{ message: "Simulated archive failure" }],
            });
          }
          if (!state.deletedProjectIds.includes(variables.id)) {
            state.deletedProjectIds.push(variables.id);
          }
          return sendJson(res, 200, { data: { projectArchive: true } });
        }
        case "projectCreate": {
          const project = {
            id: variables.id,
            name: variables.name,
            rootDocumentId: variables.rootDocumentId,
            teamProjectId: variables.teamProjectId,
            teams: CLOUD_SYNC_TEAMS,
          };
          state.newProjects.push(project);
          return sendJson(res, 200, {
            data: {
              projectCreate: {
                id: project.id,
                name: project.name,
                rootDocumentId: project.rootDocumentId,
              },
            },
          });
        }
        case "branchRemove": {
          return sendJson(res, 200, { data: { branchRemove: true } });
        }
        case "snapshotsCreate": {
          const snapshots = variables.snapshots ?? [];
          state.newSnapshots[variables.projectId] = [
            ...(state.newSnapshots[variables.projectId] ?? []),
            ...snapshots,
          ];
          return sendJson(res, 200, { data: { snapshotsCreate: snapshots } });
        }
        case "blobsCreate": {
          for (const blob of variables.blobs ?? []) {
            try {
              const decrypted = decryptCloudSyncBlob(JSON.parse(blob.content));
              state.newBlobs[blob.id] = zlib
                .gunzipSync(decrypted)
                .toString("utf8");
            } catch {
              state.newBlobs[blob.id] = blob.content;
            }
          }
          return sendJson(res, 200, {
            data: { blobsCreate: { count: (variables.blobs ?? []).length } },
          });
        }
        default: {
          return sendJson(res, 200, {
            data: null,
            errors: [{ message: `Unhandled mutation: ${operationName}` }],
          });
        }
      }
    })
    .catch((err) => {
      console.error("[mock-api]", err);
      sendJson(res, 400, {
        data: null,
        errors: [{ message: "GraphQL parse error" }],
      });
    });
}

// Vault Key state (SRP salt/verifier from generate/reset, plus in-flight
// unlock exchanges), isolated per `x-session-id` — same per-worker scoping
// as `cloudSyncStateBySession` above. Runs a REAL SRP exchange against the
// app's own `@getinsomnia/srp-js` client code (same npm package, same
// version) rather than canned responses, so an incorrect vault key
// genuinely fails `Server#checkM1()` and a correct one genuinely succeeds —
// see `handleVault()`.
const vaultStateBySession = new Map(); // sessionId -> { salt, verifier }
const vaultExchanges = new Map(); // sessionStarterId -> srp.Server instance

function resetVaultState(sessionId) {
  vaultStateBySession.delete(sessionId);
  for (const [id, exchange] of vaultExchanges) {
    if (exchange.sessionId === sessionId) vaultExchanges.delete(id);
  }
}

let srpModulePromise;
function loadSrp() {
  if (!srpModulePromise) {
    // @getinsomnia/srp-js's dist bundle is built for a browser/Electron
    // renderer context (Vite) — its bundled node-forge assumes `self`/
    // `window` exist for RNG seeding and crashes on import under plain
    // Node otherwise. `self` must be set before this dynamic import
    // resolves (a static top-level `import` runs before any assignment
    // above it, so this only works because it's a dynamic import).
    globalThis.self = globalThis.self ?? globalThis;
    srpModulePromise = import("@getinsomnia/srp-js");
  }
  return srpModulePromise;
}

function isVaultRoute(method, pathname) {
  return (
    method === "POST" &&
    (pathname === "/v1/user/vault" ||
      pathname === "/v1/user/vault/reset" ||
      pathname === "/v1/user/vault-verify-a" ||
      pathname === "/v1/user/vault-verify-m1")
  );
}

async function handleVault(req, res, url) {
  const sessionId = req.headers["x-session-id"];
  const body = await readJsonBody(req);

  if (url.pathname === "/v1/user/vault" || url.pathname === "/v1/user/vault/reset") {
    vaultStateBySession.set(sessionId, { salt: body.salt, verifier: body.verifier });
    return sendJson(res, 200, {});
  }

  const srp = await loadSrp();
  // srp-js's own internal `Buffer.isBuffer()` checks are tied to its own
  // bundled 'buffer' package class, not Node's native Buffer — Node's
  // `instanceof` doesn't match across the two, so every buffer handed to
  // `Server` must be built via srp.Buffer, not the global Buffer.
  const { Buffer: SrpBuffer, Server, params, genKey } = srp;
  const vaultKeyParams = params[2048];

  if (url.pathname === "/v1/user/vault-verify-a") {
    const stored = vaultStateBySession.get(sessionId);
    if (!stored) return sendJson(res, 400, { error: "vault not initialized" });

    const secret2 = await genKey();
    const server = new Server(
      vaultKeyParams,
      SrpBuffer.from(stored.verifier, "hex"),
      secret2,
    );
    server.setA(SrpBuffer.from(body.srpA, "hex"));
    const srpB = server.computeB().toString("hex");

    const sessionStarterId = crypto.randomUUID();
    server.sessionId = sessionId;
    vaultExchanges.set(sessionStarterId, server);
    return sendJson(res, 200, { sessionStarterId, srpB });
  }

  // /v1/user/vault-verify-m1
  const server = vaultExchanges.get(body.sessionStarterId);
  vaultExchanges.delete(body.sessionStarterId);
  if (!server) return sendJson(res, 400, { error: "no such vault exchange" });

  let srpM2;
  try {
    const m2 = server.checkM1(SrpBuffer.from(body.srpM1, "hex"));
    if (!m2) return sendJson(res, 400, { error: "SRP M1 mismatch" });
    srpM2 = m2.toString("hex");
  } catch (err) {
    console.error("[mock-api]", err);
    return sendJson(res, 400, { error: "Bad request" });
  }
  return sendJson(res, 200, { srpM2 });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

async function handleAdmin(req, res, url) {
  if (url.pathname === "/_admin/session-keys" && req.method === "GET") {
    return sendJson(res, 200, {
      publicKey: {
        alg: "RSA-OAEP-256",
        e: "AQAB",
        ext: true,
        key_ops: ["encrypt"],
        kty: "RSA",
        n: PUBLIC_KEY_N,
      },
      encPrivateKey: ENC_PRIVATE_KEY,
      symmetricKey: CLOUD_SYNC_SYMMETRIC_KEY,
    });
  }
  if (url.pathname === "/_admin/features/git-sync" && req.method === "PUT") {
    const body = await readJsonBody(req);
    const enabled = body.enabled !== false;
    setFeatureState(body.sessionId, { gitSyncEnabled: enabled });
    return sendJson(res, 200, { enabled });
  }
  if (
    url.pathname === "/_admin/storage-rule/git-sync" &&
    req.method === "PUT"
  ) {
    const body = await readJsonBody(req);
    const enabled = body.enabled !== false;
    setFeatureState(body.sessionId, { gitSyncStorageRuleEnabled: enabled });
    return sendJson(res, 200, { enabled });
  }
  if (
    url.pathname === "/_admin/features/konnect-entitlement" &&
    req.method === "PUT"
  ) {
    const body = await readJsonBody(req);
    const enabled = body.enabled !== false;
    setFeatureState(body.sessionId, { konnectEntitlementEnabled: enabled });
    return sendJson(res, 200, { enabled });
  }
  if (url.pathname === "/_admin/cloud-sync/new-commit" && req.method === "PUT") {
    const body = await readJsonBody(req);
    const state = getCloudSyncState(body.sessionId);
    state.remoteHasNewCommit = body.enabled !== false;
    if (body.projectId) {
      state.newCommitProjectId = body.projectId;
    }
    return sendJson(res, 200, {
      enabled: state.remoteHasNewCommit,
      projectId: state.newCommitProjectId,
    });
  }
  if (url.pathname === "/_admin/cloud-sync/reset" && req.method === "POST") {
    const body = await readJsonBody(req);
    resetCloudSyncState(body.sessionId);
    return sendJson(res, 200, {});
  }
  if (url.pathname === "/_admin/cloud-sync/delay" && req.method === "POST") {
    const body = await readJsonBody(req);
    const state = getCloudSyncState(body.sessionId);
    state.delayMs = Number(body.ms) || 0;
    state.delayProjectId = body.projectId ?? null;
    return sendJson(res, 200, {
      delayMs: state.delayMs,
      delayProjectId: state.delayProjectId,
    });
  }
  if (
    url.pathname === "/_admin/cloud-sync/request-log" &&
    req.method === "GET"
  ) {
    const sessionId = url.searchParams.get("sessionId");
    const state = getCloudSyncState(sessionId);
    return sendJson(res, 200, { requestLog: state.requestLog });
  }
  if (
    url.pathname === "/_admin/cloud-sync/archive-failure" &&
    req.method === "POST"
  ) {
    const body = await readJsonBody(req);
    const state = getCloudSyncState(body.sessionId);
    state.archiveShouldFail = body.enabled !== false;
    return sendJson(res, 200, { archiveShouldFail: state.archiveShouldFail });
  }
  if (
    url.pathname === "/_admin/cloud-sync/project-info" &&
    req.method === "GET"
  ) {
    const sessionId = url.searchParams.get("sessionId");
    const name = url.searchParams.get("name");
    const state = getCloudSyncState(sessionId);
    const project = [...cloudSyncProjects, ...state.newProjects].find(
      (p) => p.name === name,
    );
    if (!project) {
      return sendJson(res, 404, { error: `No fixture project named ${name}` });
    }
    const snapshots = getCloudSyncSnapshotsForProject(project.id, sessionId);
    const latest = snapshots[snapshots.length - 1];
    const workspaceEntry = latest?.state.find((entry) =>
      entry.key.startsWith("wrk_"),
    );
    return sendJson(res, 200, {
      id: project.id,
      rootDocumentId: project.rootDocumentId,
      latestSnapshotWorkspaceKey: workspaceEntry?.key ?? null,
      deleted: state.deletedProjectIds.includes(project.id),
    });
  }
  if (url.pathname === "/_admin/vault/reset" && req.method === "POST") {
    const body = await readJsonBody(req);
    resetVaultState(body.sessionId);
    return sendJson(res, 200, {});
  }
  sendJson(res, 404, { error: "not found" });
}

const ROUTES = {
  "GET /v3/users/me": {
    id: ACCOUNT_ID,
    email: "insomnia-user@konghq.com",
    first_name: "Rick",
    last_name: "Morty",
    picture: "",
    emails: [],
    encryption_enabled: true,
    is_externally_provisioned: false,
  },
  "GET /v3/users/me/encryption-keys": {
    public_key: JSON.stringify({
      alg: "RSA-OAEP-256",
      e: "AQAB",
      ext: true,
      key_ops: ["encrypt"],
      kty: "RSA",
      n: PUBLIC_KEY_N,
    }),
    enc_private_key: JSON.stringify(ENC_PRIVATE_KEY),
    enc_symmetric_key: JSON.stringify(ENC_SYMMETRIC_KEY),
    salt_enc: "",
    enc_driver_key: null,
  },
  "GET /v1/organizations": {
    organizations: [
      {
        id: ORG_ID,
        name: "feb56ab4b19347c4b648c99bfa7db363",
        display_name: "Personal workspace",
        branding: { logo_url: "" },
        metadata: { organizationType: "personal", ownerAccountId: ACCOUNT_ID },
      },
    ],
  },
  "GET /v3/users/me/spaces": {
    data: [
      {
        id: ORG_ID,
        name: "Personal workspace",
        picture: null,
        owner_first_name: null,
        owner_last_name: null,
        owner_email: null,
        total_members: 1,
        total_invites: 0,
        is_owner: true,
        can_leave: false,
      },
    ],
    meta: { page: { next: null } },
  },
  "GET /v1/billing/current-plan": {
    isActive: true,
    period: "year",
    planId: "enterprise",
    planName: "Enterprise",
    price: 100,
    quantity: 10,
    type: "enterprise",
  },
  "GET /v1/organizations/roles": [
    { id: "role_owner", name: "owner", description: "Owner" },
    { id: "role_admin", name: "admin", description: "Admin" },
    { id: "role_member", name: "member", description: "Member" },
  ],
  "GET /mock-llm/models": {
    data: [
      { id: "mock-llm-model-1", object: "model" },
      { id: "mock-llm-model-2", object: "model" },
    ],
  },
};

// Invite collaborators — a per-session mutable "Invitation list", keyed by
// the same `x-session-id` header setFeatureState()/getFeatureState() above
// already isolate concurrent Playwright workers by. Seeded with a handful
// of existing members/invites so the modal opens with a non-empty list;
// `start-adding`'s `emails` body then grows it exactly like a real invite
// would, which is what lets a spec assert the list count increases by the
// number of collaborators it actually invited.
const COLLABORATOR_ROLE_IDS = {
  owner: "role_owner",
  admin: "role_admin",
  member: "role_member",
};

function seedCollaborator(type, index) {
  const email = `existing-collaborator-${index}@example.com`;
  const base = {
    id: `collab_seed_${index}`,
    picture: "https://static.insomnia.rest/insomnia-gorilla.png",
    type,
    name: email,
    createdAt: "2024-09-14T10:16:10.513Z",
  };
  return type === "member"
    ? {
        ...base,
        metadata: {
          userId: `acct_collab_seed_${index}`,
          roleId: index === 0 ? COLLABORATOR_ROLE_IDS.owner : COLLABORATOR_ROLE_IDS.member,
          email,
        },
      }
    : {
        ...base,
        metadata: {
          invitationId: `uinv_collab_seed_${index}`,
          roleId: COLLABORATOR_ROLE_IDS.member,
          email,
          expiresAt: "2077-09-21T10:16:10.513Z",
        },
      };
}

const SEED_COLLABORATORS = [
  seedCollaborator("member", 0),
  seedCollaborator("member", 1),
  seedCollaborator("invite", 2),
];

const COLLABORATOR_SEARCH_RESULTS = Array.from({ length: 8 }, (_, i) => ({
  id: `search_result_${i}`,
  picture: "https://static.insomnia.rest/insomnia-gorilla.png",
  type: "member",
  name: `searchable-collaborator-${i}@example.com`,
}));

const collaboratorsBySession = new Map(); // sessionId -> Collaborator[]

function getCollaboratorsState(sessionId) {
  if (!collaboratorsBySession.has(sessionId)) {
    collaboratorsBySession.set(
      sessionId,
      SEED_COLLABORATORS.map((c) => ({ ...c, metadata: { ...c.metadata } })),
    );
  }
  return collaboratorsBySession.get(sessionId);
}

async function handleCollaborators(req, res, url) {
  const { method } = req;
  const segs = url.pathname.split("/").filter(Boolean);
  const sessionId = req.headers["x-session-id"];

  if (
    method === "GET" &&
    segs[0] === "v1" &&
    segs[1] === "desktop" &&
    segs[2] === "organizations" &&
    segs[4] === "collaborators" &&
    segs.length === 5
  ) {
    const collaborators = getCollaboratorsState(sessionId);
    return sendJson(res, 200, {
      collaborators,
      start: 0,
      limit: 15,
      length: collaborators.length,
      total: collaborators.length,
      next: "",
    });
  }

  if (
    method === "GET" &&
    segs[0] === "v1" &&
    segs[1] === "desktop" &&
    segs[2] === "organizations" &&
    segs[4] === "collaborators" &&
    segs[5] === "search"
  ) {
    return sendJson(res, 200, COLLABORATOR_SEARCH_RESULTS);
  }

  if (
    method === "POST" &&
    segs[0] === "v1" &&
    segs[1] === "desktop" &&
    segs[2] === "organizations" &&
    segs[4] === "collaborators" &&
    segs[5] === "start-adding"
  ) {
    const body = await readJsonBody(req);
    const collaborators = getCollaboratorsState(sessionId);
    for (const email of body.emails ?? []) {
      collaborators.push({
        id: `collab_invited_${collaborators.length}`,
        picture: "https://static.insomnia.rest/insomnia-gorilla.png",
        type: "invite",
        name: email,
        createdAt: new Date(2024, 8, 14).toISOString(),
        metadata: {
          invitationId: `uinv_invited_${collaborators.length}`,
          roleId: COLLABORATOR_ROLE_IDS.member,
          email,
          expiresAt: "2077-09-21T10:16:10.513Z",
        },
      });
    }
    return sendJson(res, 200, {
      acct_2346c8e88dae47e2a1a5cae04dc68ea3: {
        accountId: "acct_2346c8e88dae47e2a1a5cae04dc68ea3",
        publicKey: JSON.stringify({
          alg: "RSA-OAEP-256",
          e: "AQAB",
          ext: true,
          key_ops: ["encrypt"],
          kty: "RSA",
          n: PUBLIC_KEY_N,
        }),
        autoLinked: false,
      },
    });
  }

  if (
    method === "POST" &&
    segs[0] === "v1" &&
    segs[1] === "desktop" &&
    segs[2] === "organizations" &&
    segs[4] === "collaborators" &&
    segs[5] === "finish-adding"
  ) {
    return sendJson(res, 200, null);
  }

  if (
    method === "POST" &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "check-seats"
  ) {
    return sendJson(res, 200, { isAllowed: true });
  }

  if (
    method === "PATCH" &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "invites"
  ) {
    const body = await readJsonBody(req);
    const invitationId = segs[4];
    const collaborators = getCollaboratorsState(sessionId);
    const invite = collaborators.find(
      (c) => c.metadata.invitationId === invitationId,
    );
    if (invite) invite.metadata.roleId = body.roles?.[0] ?? invite.metadata.roleId;
    return sendJson(res, 200, {});
  }

  if (
    method === "PATCH" &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "members" &&
    segs[5] === "roles"
  ) {
    const body = await readJsonBody(req);
    const userId = segs[4];
    const collaborators = getCollaboratorsState(sessionId);
    const member = collaborators.find((c) => c.metadata.userId === userId);
    if (member) member.metadata.roleId = body.roles?.[0] ?? member.metadata.roleId;
    return sendJson(res, 200, {});
  }

  sendJson(res, 404, { error: `no collaborators route for ${method} ${url.pathname}` });
}

function isCollaboratorsRoute(method, pathname) {
  const segs = pathname.split("/").filter(Boolean);
  if (
    segs[0] === "v1" &&
    segs[1] === "desktop" &&
    segs[2] === "organizations" &&
    segs[4] === "collaborators"
  ) {
    return true;
  }
  if (
    method === "POST" &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "check-seats"
  ) {
    return true;
  }
  if (
    method === "PATCH" &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    (segs[3] === "invites" || (segs[3] === "members" && segs[5] === "roles"))
  ) {
    return true;
  }
  return false;
}

const KONNECT_ORGANIZATION_ID = "konnect-org-e2e";
const KONNECT_CONTROL_PLANE = {
  id: "cp-e2e-1",
  name: "E2E Control Plane",
  description: "Control plane served by the mock API",
  config: {
    cluster_type: "CLUSTER_TYPE_CONTROL_PLANE",
    control_plane_endpoint: "https://cp-e2e-1.us.cp0.konghq.com",
    cloud_gateway: false,
  },
  proxy_urls: [{ host: "proxy.e2e.example.com", port: 443, protocol: "https" }],
};
const KONNECT_SERVICES = [
  {
    id: "svc-http",
    name: "E2E HTTP Service",
    protocol: "https",
    host: "upstream.example.com",
    port: 443,
    path: null,
    enabled: true,
    tags: null,
  },
  {
    id: "svc-realtime",
    name: "E2E Realtime Service",
    protocol: "http",
    host: "upstream.example.com",
    port: 80,
    path: null,
    enabled: true,
    tags: null,
  },
];
const KONNECT_ROUTES = {
  "svc-http": [
    {
      id: "route-traditional",
      name: "users",
      methods: ["GET", "POST"],
      paths: ["/users", "/users/{id}"],
      protocols: ["https"],
      hosts: ["api.example.com"],
      headers: { "x-env": ["prod"] },
      snis: null,
      expression: null,
      service: { id: "svc-http" },
    },
    {
      id: "route-multi-protocol",
      name: "health",
      methods: ["GET"],
      paths: ["/health"],
      protocols: ["http", "https"],
      hosts: null,
      headers: null,
      snis: null,
      expression: null,
      service: { id: "svc-http" },
    },
    {
      id: "route-expression",
      name: "orders-expression",
      methods: null,
      paths: null,
      protocols: ["https"],
      hosts: null,
      headers: null,
      snis: null,
      expression:
        'http.method == "DELETE" && http.path ^= "/orders" && http.host == "orders.example.com"',
      service: { id: "svc-http" },
    },
    {
      id: "route-expression-sni",
      name: "sni-expression",
      methods: null,
      paths: null,
      protocols: ["https"],
      hosts: null,
      headers: null,
      snis: null,
      expression: 'tls.sni == "secure.example.com"',
      service: { id: "svc-http" },
    },
  ],
  "svc-realtime": [
    {
      id: "route-grpc",
      name: "greeter",
      methods: null,
      paths: ["/helloworld.Greeter/SayHello"],
      protocols: ["grpc"],
      hosts: null,
      headers: { "x-trace": ["1"] },
      snis: null,
      expression: null,
      service: { id: "svc-realtime" },
    },
    {
      id: "route-ws",
      name: "events",
      methods: null,
      paths: ["/ws/events"],
      protocols: ["ws", "wss"],
      hosts: null,
      headers: null,
      snis: null,
      expression: null,
      service: { id: "svc-realtime" },
    },
  ],
};

function matchDynamic(req, url) {
  const { method } = req;
  const pathname = url.pathname;
  const segs = pathname.split("/").filter(Boolean);
  const featureState = getFeatureState(req.headers["x-session-id"]);

  if (
    method === "GET" &&
    segs.length === 4 &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "features"
  ) {
    return {
      features: {
        gitSync: { enabled: featureState.gitSyncEnabled },
        bulkImport: { enabled: true },
        orgBasicRbac: { enabled: true },
        aiMockServers: { enabled: true },
        aiCommitMessages: { enabled: true },
        aiMcpClient: { enabled: true },
      },
      billing: {
        isActive: true,
        expirationWarningMessage: "",
        expirationErrorMessage: "",
        accessDenied: false,
      },
    };
  }
  if (
    method === "GET" &&
    segs.length === 4 &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "team-projects"
  ) {
    return { data: [{ id: PROJECT_ID, name: "Personal Workspace" }] };
  }
  if (
    method === "GET" &&
    segs.length === 4 &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "user-permissions"
  ) {
    return {
      "create:team_project": true,
      "delete:team_project": true,
      "read:team_project": true,
      "update:team_project": true,
      "own:organization": true,
      "create:invitation": true,
      "read:invitation": true,
      "delete:invitation": true,
      "read:membership": true,
      "update:membership": true,
      "delete:membership": true,
      "update:organization": true,
      "delete:organization": true,
      "delete:file": true,
    };
  }
  if (
    method === "GET" &&
    segs.length === 4 &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "storage-rule"
  ) {
    return {
      enableCloudSync: true,
      enableGitSync: featureState.gitSyncStorageRuleEnabled,
      enableLocalVault: true,
      isOverridden: false,
    };
  }
  if (
    method === "GET" &&
    segs.length === 4 &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "members"
  ) {
    return { start: 0, limit: 10, length: 1, total: 1, next: "", members: [] };
  }
  if (
    method === "GET" &&
    segs.length === 4 &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "invites"
  ) {
    return {
      start: 0,
      limit: 10,
      length: 0,
      total: 0,
      next: "",
      invitations: [],
    };
  }
  if (
    method === "GET" &&
    segs.length === 4 &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "my-project-keys"
  ) {
    return [];
  }
  if (
    method === "GET" &&
    segs.length === 6 &&
    segs[0] === "v1" &&
    segs[1] === "organizations" &&
    segs[3] === "members" &&
    segs[5] === "roles"
  ) {
    return { roleId: "role_owner", name: "owner", description: "Owner" };
  }
  if (method === "GET" && pathname === "/v3/organizations/me") {
    return { id: KONNECT_ORGANIZATION_ID };
  }
  if (method === "GET" && pathname.startsWith("/v2/control-planes")) {
    const konnectSegs = segs.slice(2);
    // /v2/control-planes
    if (konnectSegs.length === 0) {
      return {
        data: [KONNECT_CONTROL_PLANE],
        meta: { page: { number: 1, size: 100, total: 1 } },
      };
    }
    // /v2/control-planes/:cpId/core-entities/services
    if (konnectSegs.length === 3 && konnectSegs[2] === "services") {
      return { data: KONNECT_SERVICES, offset: null };
    }
    // /v2/control-planes/:cpId/core-entities/services/:serviceId/routes
    if (konnectSegs.length === 5 && konnectSegs[4] === "routes") {
      return { data: KONNECT_ROUTES[konnectSegs[3]] ?? [], offset: null };
    }
    return { data: [] };
  }

  if (method === "GET" && pathname === "/v1/user/entitlements") {
    return {
      entitlements: featureState.konnectEntitlementEnabled
        ? [
            {
              featureKey: "konnectControlPlanes_default",
              type: "metered",
              hasAccess: true,
              allowance: null,
            },
          ]
        : [],
    };
  }

  return null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost:4010");
  const key = `${req.method} ${url.pathname}`;
  process.stdout.write(`${key}\n`);

  if (req.method === "GET" && url.pathname.startsWith("/builds/check/")) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(": no update available\n\n");
    return;
  }

  if (url.pathname.startsWith("/_admin/")) {
    handleAdmin(req, res, url).catch((err) => {
      console.error("[mock-api]", err);
      sendJson(res, 400, { error: "Bad request" });
    });
    return;
  }

  if (url.pathname === "/graphql" && req.method === "POST") {
    handleCloudSyncGraphQL(req, res);
    return;
  }

  if (isCollaboratorsRoute(req.method, url.pathname)) {
    handleCollaborators(req, res, url).catch((err) => {
      console.error("[mock-api]", err);
      sendJson(res, 400, { error: "Bad request" });
    });
    return;
  }

  if (isVaultRoute(req.method, url.pathname)) {
    handleVault(req, res, url).catch((err) => {
      console.error("[mock-api]", err);
      sendJson(res, 400, { error: "Bad request" });
    });
    return;
  }

  let body = ROUTES[key];
  if (body === undefined) {
    body = matchDynamic(req, url);
  }

  if (body !== null && body !== undefined) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(body));
  } else if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
    });
    res.end();
  } else {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end("{}");
  }
});

server.listen(4010, "127.0.0.1", () => {
  process.stdout.write("Listening at http://localhost:4010\n");
});
