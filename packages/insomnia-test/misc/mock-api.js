#!/usr/bin/env node
"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { parse } = require("graphql");

const ACCOUNT_ID = "acct_64a477e6b59d43a5a607f84b4f73e3ce";
const ORG_ID = "org_7ef19d06-5a24-47ca-bc81-3dea011edec2";
const PROJECT_ID = "proj_org_7ef19d06-5a24-47ca-bc81-3dea011edec2";

// Regenerated 2026-08-31 — the previous PUBLIC_KEY_N/ENC_KEY_D pair below
// were from two different, unrelated RSA keypairs (n mismatched entirely),
// so any real RSA-OAEP-256 unwrap the app performed against
// CLOUD_SYNC_ENCRYPTED_SYMMETRIC_KEY below (e.g. `_VCS.customFetch` during
// a Cloud Sync "Fetch unsynced workspace") failed with "Invalid RSAES-OAEP
// padding" — deterministically, not just under parallel load. This pair is
// now a single self-consistent keypair; round-trip verified: decrypt
// `enc_private_key` below with CLOUD_SYNC_SYMMETRIC_KEY, then RSA-OAEP
// decrypt CLOUD_SYNC_ENCRYPTED_SYMMETRIC_KEY with the recovered private key
// yields CLOUD_SYNC_SYMMETRIC_KEY.k exactly. Keep `publicKey.n` in
// misc/fixtures.ts's INSOMNIA_SESSION in sync with this value.
const PUBLIC_KEY_N =
  "5h0z0z5R_0oxtdzFGAeVAie9T3HdnQ9U1oIo5PjK-nM3HD2heYDVD_RX6uSwxGy6Mt21aNyC6rAq5sQAh1_uIcf1pifeLqOH0TaN0g2iA2JfRqqO37Tzv5AVQQavdeqKOQCpDQiRM_fP1FzQVcgE4YGUGtbVUGt7FO_XvbHhp-ScZLrLC4AplrJeykxAKq7_qMX3hJGbURXtNWu36pyXpFV87QAxMBdpU-ZmnxSFcKrJAv0Y6WcfkFITgn8bmxFTliFhNPvpAk4AP2ltNlp-Vy63BI_ddt35yNnkKhZyboeW_VfMPypw2Ar5TkH314Qkl9psamkkBVmUdAyiE9YvcQ";
// AES-256-GCM ciphertext of the matching private key JWK (URL-encoded
// JSON), encrypted with CLOUD_SYNC_SYMMETRIC_KEY — iv/tag are inlined at
// each call site below (`enc_private_key`'s "iv"/"t") since both call
// sites need to agree; keep them in sync if this changes.
const ENC_KEY_D =
  "0a46ee78889a1478add7efe116d4d30bd7e361a9bb0417605989fd7b96a90fcf81ce46e9ed706f311fb44c351536832ace1da3b62c866f1ed9d2e2be627d1e0a426b338ece60d753b3143bf60802665a2317834482dbb2287f3f1117274d4740b84e8c642b3f5665db46422da0b2ffdd18cf1f19519ebe7ff2dd532f735633439229d3b4238b936b70e2372ba2a989693a752c292d93ed858cc71cb659dfe4801b46d910318b0b938345b6fc22c5c8721ccc951a3a4f45db525e57b499c156d8faed364d9bbd983f047559a130f8cff3c640b750196041db473030fdc4a86557987bfbf58013447ad7395f20f333c493f5fc55481a1b4c987ff34ced6d6c87358948e808449cda3920c410db0cc471ca40e5a6772ded0b37a234dd22dd1a896954fb53e9086ca231ed1e47fd03579543521e169f834ac364fd0045b529c93f0759af8ecdc95973ee5dfb05a10e05158717f85ec714423d54baae0d584a5c22f3d04240b853ee2fb67401c765549b29b8e1b9742247148d16fe23b5bcaa6c8a039a74936626cd0396313ed56a9c32ae631599ffdce90355385aada2d64edd09fcb4c820d6ff671bd9511f275410d89d8c3f94c7e0946767ebcdcb1930d358068574e71b31935e02259f314fcd7f3a8c0c8bbfa81a2ba7480e8a299227d8ac9899ad3098399b61aa3fd0e9e0811f10bd2adab59153f0604b596d240dccfbee526d1ded57641cc741bb9106f73d347b031194b6006f74ca005fc6b8145e53a6eb13c396b1f9bb3e6e357879a36cee68fa1c84fe4ec9c703232952eb775d94fd01c06247af58993ebe5d9c8e42a5c293f51122d434eadadd3c40533a82e26ce3fffcc656020a75596b0b593bc2d59ada41457e7e4cf527e0a16b63132db83e210d2c00e81eff1e69d9914c6fdebd2cf36dc688aa4ca7e46c668bd2b830f17f897802c0b7a749ad54091e33b467d5bcfbb6644bea4f41ddb08abda513c2aac52fa787d9af7cf8543aacc3c6f5b606f56cdd735059ca5de71b08d9e5e45214659e79575f37c7cd64741759af8acbf9eadbd2e2039737ce2081b688029d0b607a4402b7b66121fc0101bcbd2f3caf171a3c486c02c3db1a5ec2ed7392bc9b1190c95177a2a1b69f3f904d1d0a02bb411bc9613d87f47b86fa1a7289b9385820301e0c77e2a724f090f9220276490af49a18a2c7eb8067b1ea2dadbb9d08c18e30cc40ceffa5558801957f90d0513c6b83cc1829c592e5d9c955d24d543669b395e8fafd5c6b7ae661664b8791d6e4746e72c39feb80efb83205f34c83fa854db8c55d3c2db3d7baded8f5968a4ec9eeb2dc8a4d9260c75f44c82688110b6c2983c2b966be19b4d7fd6f20387d7b491004deb4389e376e60fc4123872d34979f86917ff77c63393b8519d02c13453068a4fd01a5ce77c563da1dc73347e29b575b9fbe7fd91b100ebfa8896a1df27923817f353c9484a9c0984626dc48951c99e6ed9771cbcff70c9626249c51443db852e69043ecbd62f4b79d83f6ae183e6987bf1de48bb814fc71002f22bc85d9fc58068af8dc5323c35160e662df6bb9741f5484a7c3713f2fa758c17fe62223f3988562662c25af1256cb446f5be717bbf48b97ffb25e3bc0673b95e67943083194f07b2f192de763367e2e77c524307d57ec8c14954f1a20e18a45f12f8c38b7950742e4a4905b89f7492e899c05c6a512f36366461aa9f86bc338896eee2d0f078116d982c66c8b88be80740f2fb1fe82a1cb8ee2fab9130f2ebb8b0a1ce4d43979b02b40f6391cd25dbe81c32241e9aeb5e2a1f99bbaed4dff490bc46638b76b1540475ef95e7e0351931aa9c4c29682ee762b797289259bb8dc46f5c193408f71b9a91fe85f3a7a9858078a554dd9ef5a42193f30ad24f2df16ca87c517e63aed30bed60383e4426a15ae806064cd978a68560c067d648ac0ed6672e7e74c3452894878eca95ba3102ed9c1b58300492b79bbcde14b86267179082af0a3c2c85e0bd7e49563071c5ac1e5de72add19bd2d8773b4fa983f10e2650b19bc3f25a50e738d084b07a0a60373c6fcfab070fa0a98fc7a87d1c8e3b671e6204d51264ba1baea6e99c0719bcd59749ceebc43309ac42b3e424ec9088973a4b03239426fb9c47e89021ca5515af87929fcf299730247565092ba5a39180d26d11e80439fb2b4f716ee2a33a7fde39a6af06598ce8079163a44d3c444f879f68119186d2b21cf59ea0f3e39341e70c789300bf3597b41370829d23a671dbe3b87a28b0871d31f4a7dd4682218122cf7ca9362253f5a826fcfba46e8613f71647e7097f25fb67e74ef7c5c6a4cf5aece0ad28927c1d96e2a23bc6ab2a20593f253e509e850ee6b40470d5f7ff478c7c1e58a94d54a5812f7e072e37f084ebd23e2d9897ee6dd54945fb87c7eea23e1c401a3eca01e993373ea7154846d96677139720a8457e601b858c61f58e61cbb7658389290423af81cc3bf5dfe69f12b8edd94eb3aa1d93b0f2125546d848b7e76954b3a79d3c38e96f97a2c8298a27c6101fe1b51cd2764e60b83378b035f6";

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
  konnectSyncEnabled: true,
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
const CLOUD_SYNC_SYMMETRIC_KEY = {
  alg: "A256GCM",
  ext: true,
  k: "w62OJNWF4G8iWA8ZrTpModiY8dICyHI7ko1vMLb877g=",
  key_ops: ["encrypt", "decrypt"],
  kty: "oct",
};
// Plaintext (before RSA-OAEP-256) is the *full symmetric-key JWK*, URL-
// encoded JSON — same convention as `enc_private_key`'s plaintext below, not
// the raw 32 key bytes (an earlier version of this fix RSA-encrypted the
// raw bytes directly, which decrypted fine but then failed downstream:
// `JSON.parse(decodeURIComponent(<raw AES key bytes>))` on garbage,
// "Unexpected token ... is not valid JSON"). `k` is unpadded base64url (no
// trailing "=") to fit the 2048-bit/SHA-256 OAEP 190-byte plaintext limit.
const CLOUD_SYNC_ENCRYPTED_SYMMETRIC_KEY =
  "ce2a6be097233148d827a1939f99fbdbb665de2058ac45e727328aa6d238d15acdf0a972a6f25c252764694a9d9f4a1e9234b1984cd29b481954c800388c339bc8c77f45c0a76a9350f950f2b07a6d1b6f3f269623025fd4b8ccd22a004cf6917e3bb1adb15a9112323b19fd4ff438c7712b9ace59919ab6d9cf7089c3d1c0193654500575008c08786e76140904179e4ae2a921ed001bdec7e3cd6614e43ef86c6dbf19d7825497d2df6e9651475787120f3edd3841578ed40954b66213f98eabd8596587fe891e07c7fe48d71bf03d5da45d8c255da611b9cd699625cb1ed86a77fcce9dadfc83f2f9a4399f50f7552384dfe9351079e3cb443456af96fce8";

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
      sendJson(res, 400, {
        data: null,
        errors: [{ message: `GraphQL parse error: ${String(err)}` }],
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
    return sendJson(res, 400, { error: String(err) });
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
    url.pathname === "/_admin/features/konnect-sync" &&
    req.method === "PUT"
  ) {
    const body = await readJsonBody(req);
    const enabled = body.enabled !== false;
    setFeatureState(body.sessionId, { konnectSyncEnabled: enabled });
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
    enc_private_key: JSON.stringify({
      iv: "ee5a6e16693b3b61ae2cf07d",
      t: "d0a8c3b2ff15771e56ba890907ea6bc7",
      d: ENC_KEY_D,
      ad: "",
    }),
    // Was a byte-for-byte copy of enc_private_key above (wrong plaintext
    // entirely — this must decrypt to the account's raw symmetric key, not
    // its RSA private key JWK). Now its own distinct ciphertext, same
    // CLOUD_SYNC_SYMMETRIC_KEY-keyed AES-256-GCM scheme.
    enc_symmetric_key: JSON.stringify({
      iv: "4d2f0b5c78aefeb98c95ffd5",
      t: "ac78bd5e8a8c7874b681e037c41013fa",
      d: "41a9d66f79ccb3d4c5ffe51da8a4b308e3bbdc271683cf012b00597ea869d9fc4b96105a4ad71b3d69fa8b9cf2c354cfbd4fd2eeb9edcdfe95df1350b39cadbb05233797e1c445b1fea58c794eb5c39ae41ab9253476872ad6a99179642c9586b60d0568e328fa0a03fa79947d23e0305c18ef78f484f84ab6f8859f4493af837ae08d2144f7079b7f904e65c450e7e71ea0d08cb750e33763b14c7baa7971efd1c552ec74b11c4f3495d1bfa507d15286b216a560586976e0d8c61a2b6fd8eebd",
      ad: "",
    }),
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
        konnectSync: { enabled: featureState.konnectSyncEnabled },
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
  if (method === "GET" && pathname.startsWith("/v2/control-planes")) {
    return { data: [] };
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
      sendJson(res, 400, { error: String(err) });
    });
    return;
  }

  if (url.pathname === "/graphql" && req.method === "POST") {
    handleCloudSyncGraphQL(req, res);
    return;
  }

  if (isCollaboratorsRoute(req.method, url.pathname)) {
    handleCollaborators(req, res, url).catch((err) => {
      sendJson(res, 400, { error: String(err) });
    });
    return;
  }

  if (isVaultRoute(req.method, url.pathname)) {
    handleVault(req, res, url).catch((err) => {
      sendJson(res, 400, { error: String(err) });
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

server.listen(4010, () => {
  process.stdout.write("Listening at http://localhost:4010\n");
});
