/**
 * Socket.IO / WebSocket payloads through the Git Sync project fs→db path.
 *
 * Lives in its own file because `repo-file-watcher.test.ts` module-mocks `common/insomnia-v5`,
 * and these tests need the real import/export.
 *
 * Before the v5 format carried the payload, `deleteOrphans` removed every payload document on
 * each real fs→db sync — a `git pull`, a `checkout`, an edit to any part of the YAML, or just
 * restarting the app — because the importer could never produce one. See INS-3123.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '../../../common/database';
import { RepoFileWatcherRegistry } from '../repo-file-watcher';

const REPO_ID = 'git_repo_payload';
const PROJECT_ID = 'proj_payload';
const WORKSPACE_ID = 'wrk_payload';
const REQUEST_ID = 'socketio-req_payload';
const PAYLOAD_ID = 'socket-io-payload_payload';
const YAML_PATH = 'insomnia.wrk_payload.yaml';

const collectionYaml = ({ withBody = true, withRequest = true } = {}) => `type: collection.insomnia.rest/5.0
schema_version: "5.1"
name: Payload Collection
meta:
  id: ${WORKSPACE_ID}
  created: 1000
  modified: 1000
collection:${
  withRequest
    ? `
  - url: https://socket.example.com
    name: Rooms
    meta:
      id: ${REQUEST_ID}
      created: 1000
      modified: 1000
      sortKey: 1${
        withBody
          ? `
    body:
      meta:
        id: ${PAYLOAD_ID}
        created: 1000
        modified: 1000
      eventName: chat message
      ack: true
      args:
        - id: arg1
          value: '"world"'
          mode: application/json`
          : ''
      }`
    : ' []'
}
environments:
  name: Base Environment
  meta:
    id: env_payload
    created: 1000
    modified: 1000
    isPrivate: false
`;

describe('RepoFileWatcher keeps Socket.IO payloads through fs→db syncs', () => {
  let repoDir: string;
  let registry: RepoFileWatcherRegistry;
  let absPath: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    await services.project.create({ _id: PROJECT_ID, name: 'Payload Project' });
    repoDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'insomnia-repo-watcher-payload-'));
    absPath = path.join(repoDir, YAML_PATH);
    registry = new RepoFileWatcherRegistry({ onDbSynced: vi.fn(), onProblemsChanged: vi.fn() });
  });

  afterEach(async () => {
    registry.stopAll();
    await fs.promises.rm(repoDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('imports a body into a real payload document keyed by the id in the file', async () => {
    await fs.promises.writeFile(absPath, collectionYaml(), 'utf8');

    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    await expect(services.socketIOPayload.getByParentId(REQUEST_ID)).resolves.toMatchObject({
      _id: PAYLOAD_ID,
      eventName: 'chat message',
      ack: true,
      args: [{ id: 'arg1', value: '"world"', mode: 'application/json' }],
    });
  });

  // A second import of the same file is what a `git pull` or `checkout` triggers — the exact
  // moment the payload used to be deleted as an orphan
  it('keeps the payload when the same file is re-imported', async () => {
    await fs.promises.writeFile(absPath, collectionYaml(), 'utf8');
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);

    await registry.importAllFiles(REPO_ID);
    await registry.flushNow(REPO_ID);

    await expect(services.socketIOPayload.getByParentId(REQUEST_ID)).resolves.toMatchObject({
      _id: PAYLOAD_ID,
      eventName: 'chat message',
    });
  });

  it('deletes the payload along with its request when the request leaves the file', async () => {
    await fs.promises.writeFile(absPath, collectionYaml(), 'utf8');
    await registry.startWatcher(REPO_ID, repoDir, PROJECT_ID);
    await expect(services.socketIOPayload.getByParentId(REQUEST_ID)).resolves.toBeDefined();

    await fs.promises.writeFile(absPath, collectionYaml({ withRequest: false }), 'utf8');
    await registry.importAllFiles(REPO_ID);
    await registry.flushNow(REPO_ID);

    await expect(services.socketIORequest.getById(REQUEST_ID)).resolves.toBeUndefined();
    await expect(services.socketIOPayload.getById(PAYLOAD_ID)).resolves.toBeUndefined();
  });
});
