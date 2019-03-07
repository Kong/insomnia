// @flow

import type { BaseDriver } from '../store/drivers/base';
import Store from '../store';
import crypto from 'crypto';
import { deterministicStringify } from '../lib/deterministicStringify';
import compress from '../store/hooks/compress';

type Project = {
  // TODO
};

type DocumentKey = string;
type BlobId = string;

type Head = {|
  branch: string,
|};

type SnapshotStateEntry = {|
  key: DocumentKey,
  blob: BlobId,
  name: string,
|};

type Snapshot = {|
  id: string,
  created: Date,
  parent: string,
  author: string,
  name: string,
  description: string,
  state: Array<SnapshotStateEntry>,
|};

type Branch = {|
  name: string,
  created: Date,
  modified: Date,
  snapshots: Array<string>,
|};

type Operation = 'add' | 'modify' | 'delete';

type StageEntry = {
  operation: Operation,
  name: string,
  blob: BlobId,
  content: Object | null,
};

type Stage = {
  [DocumentKey]: StageEntry,
};

type StatusCandidate = StageEntry & {
  key: DocumentKey,
};

type Status = {
  stage: Stage,
  unstaged: {
    [DocumentKey]: StatusCandidate,
  },
};

const EMPTY_HASH = crypto
  .createHash('sha1')
  .digest('hex')
  .replace(/./g, '0');

export default class VCS {
  _store: Store;
  _project: string;
  _author: string;
  _location: string;
  _sessionId: string;

  constructor(
    projectId: string,
    driver: BaseDriver,
    author: string,
    location: string,
    sessionId: string,
  ) {
    this._store = new Store(driver, [compress]);
    this._location = location;
    this._sessionId = sessionId;
    this._project = projectId;
    this._author = author;
    console.log('VCS', this);
  }

  async status(
    candidates: Array<{ key: DocumentKey, name: string, content: Object }>,
  ): Promise<Status> {
    const stage: Stage = await this.getStage();
    const branch = await this._getCurrentBranch();
    const snapshot = await this._getLatestSnapshot(branch.name);
    const snapshotState = snapshot ? snapshot.state : [];

    const status: Status = {
      stage,
      unstaged: {},
    };

    const stateMap = {};
    for (const entry of snapshotState) {
      stateMap[entry.key] = entry;
    }

    for (const candidate of candidates) {
      const blobId = _hashContent(candidate.content);

      // Already staged
      const { key, name } = candidate;
      if (stage[key] && stage[key].blob === blobId) {
        continue;
      }

      const stateEntry = stateMap[key];

      if (stateEntry && stateEntry.blob === blobId) {
        continue;
      }

      let operation;
      if (stateEntry) {
        console.log('[sync] Found modification', key, stateEntry.blob, '!==', blobId);
        operation = 'modify';
      } else {
        console.log('[sync] Found addition', key, blobId);
        operation = 'add';
      }

      status.unstaged[key] = {
        key,
        name,
        operation,
        blob: blobId,
        content: candidate.content,
      };
    }

    // Find deleted items
    for (const stateEntry of snapshotState) {
      const item = candidates.find(i => i.key === stateEntry.key);
      if (item) {
        // Was provided
        continue;
      }

      // Already staged, so don't add to unstaged
      const { key } = stateEntry;
      if (stage[key]) {
        continue;
      }

      status.unstaged[key] = {
        key,
        operation: 'delete',
        blob: stateEntry.blob,
        name: stateEntry.name,
        content: null,
      };
    }

    return status;
  }

  async getStage(): Promise<Stage> {
    const stage = await this._store.getItem(_pathStage());
    return stage || {};
  }

  async stage(candidate: StatusCandidate): Promise<Stage> {
    if (!candidate) {
      throw new Error('No item provided to stage');
    }

    const stage = await this.getStage();
    stage[candidate.key] = candidate;

    // Store the stage
    await this._storeStage(stage);

    // Store the entity
    await this.storeBlob(candidate.blob, candidate.content);

    console.log('STAGE', stage);
    return stage;
  }

  async unstage(candidate: StatusCandidate): Promise<Stage> {
    const stage = await this.getStage();
    delete stage[candidate.key];
    await this._store.setItem(_pathStage(), stage);
    return stage;
  }

  async getBlob(id: string): Promise<Object | null> {
    if (!id || id === EMPTY_HASH) {
      return null;
    }

    return this._store.getItem(_pathProjectBlob(this._project, id));
  }

  async getBlobRaw(id: string): Promise<Buffer | null> {
    if (!id || id === EMPTY_HASH) {
      return null;
    }

    return this._store.getItemRaw(_pathProjectBlob(this._project, id));
  }

  async storeBlob(id: string, content: Object | null): Promise<void> {
    if (!id || id === EMPTY_HASH) {
      return;
    }

    return this._store.setItem(_pathProjectBlob(this._project, id), content);
  }

  async fork(newBranchName: string): Promise<void> {
    if (await this._getBranch(newBranchName)) {
      throw new Error('Branch already exists by name ' + newBranchName);
    }

    const branch = await this._getCurrentBranch();
    const snapshotFrom = await this._getLatestSnapshot(branch.name);
    const state = snapshotFrom ? snapshotFrom.state : [];

    const snapshot: Snapshot = {
      id: _generateSnapshotID(EMPTY_HASH, this._project, newBranchName, state),
      name: `Forked from ${branch.name}`,
      description: '',
      parent: EMPTY_HASH,
      author: this._author,
      created: new Date(),
      state,
    };

    const newBranch: Branch = {
      name: newBranchName,
      created: new Date(),
      modified: new Date(),
      snapshots: [snapshot.id],
    };

    await this._storeSnapshot(snapshot);
    await this._storeBranch(newBranch);
    await this.checkout(newBranch.name);
  }

  async checkout(branchName: string): Promise<void> {
    const branch = await this._getOrCreateBranch(branchName);
    this._storeHead({ branch: branch.name });
  }

  async getBranchHistory(branchName: string): Promise<Array<Snapshot>> {
    const branch = await this._getOrCreateBranch(branchName);
    const snapshots = [];
    for (const id of branch.snapshots) {
      const snapshot = await this._getSnapshot(id);
      if (snapshot === null) {
        throw new Error(`Failed to get snapshot id=${id}`);
      }

      snapshots.push(snapshot);
    }

    return snapshots;
  }

  async getBranch(): Promise<Branch> {
    return this._getCurrentBranch();
  }

  async getBranchName(): Promise<string> {
    return (await this._getCurrentBranch()).name;
  }

  async getBranchNames(): Promise<Array<string>> {
    const branches = await this.getBranches();
    const branchNames = branches.map(b => b.name);
    branchNames.sort();
    return branchNames;
  }

  async getBranches(): Promise<Array<Branch>> {
    const paths = await this._store.keys(_pathProjectBranches(this._project));
    const branches = [];
    for (const p of paths) {
      const b = await this._store.getItem(p);
      if (b === null) {
        // Should never happen
        throw new Error(`Failed to get branch path=${p}`);
      }

      branches.push(b);
    }

    return branches;
  }

  async pull(): Promise<void> {
    // TODO: Ask server for it's history of current branch
    // TODO: Compare history with local one
    // TODO: If server has more, pull down and save entities
    // TODO: ERROR: Handle case where our HEAD is different from server
    //    - Will need to perform a merge
  }

  async takeSnapshot(name: string): Promise<void> {
    const branch: Branch = await this._getCurrentBranch();
    const parent: Snapshot | null = await this._getLatestSnapshot(branch.name);
    const parentId: string = parent ? parent.id : EMPTY_HASH;
    const stage: Stage = await this.getStage();

    // Ensure there is something on the stage
    if (Object.keys(stage).length === 0) {
      throw new Error('No changes to save');
    }

    const state: Array<SnapshotStateEntry> = [];

    // Add everything from the old state to the new state (except deleted)
    const parentState = parent ? parent.state : [];
    for (const entry of parentState) {
      const stageEntry = stage[entry.key];
      if (stageEntry && stageEntry.operation === 'delete') {
        continue;
      }

      state.push(entry);
    }

    // Add the rest of the staged items
    for (const key of Object.keys(stage)) {
      const { operation, name, blob } = stage[key];
      if (operation === 'delete') {
        continue;
      }

      state.push({ key, name, blob });
    }

    // Create the snapshot
    const id = _generateSnapshotID(parentId, this._project, branch.name, state);
    const snapshot: Snapshot = {
      id,
      name,
      state,
      parent: parentId,
      created: new Date(),
      author: this._author,
      description: '',
    };
    console.log('SNAPSHOT', snapshot);

    // Update the branch history
    branch.modified = new Date();
    branch.snapshots.push(snapshot.id);

    await this._storeBranch(branch);
    await this._storeSnapshot(snapshot);
    await this._clearStage();
  }

  async queryBlobsMissing(state: Array<SnapshotStateEntry>): Promise<Array<string>> {
    const next = async (ids: Array<string>) => {
      const resp = await window.fetch(this._location + '?missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-ID': this._sessionId },
        body: JSON.stringify(
          {
            query: `
          query ($projectId: ID!, $ids: [ID!]!) {
            blobsMissing(project: $projectId, ids: $ids) {
              missing 
            }
          }
        `,
            variables: {
              ids,
              projectId: this._project,
            },
          },
          null,
          2,
        ),
      });

      const { data, errors } = await resp.json();
      if (errors && errors.length) {
        throw new Error('Failed to fetch blobs');
      }

      return data.blobsMissing.missing;
    };

    const missingIds = [];
    const pageSize = 500;
    const pages = Math.ceil(state.length / pageSize);
    for (let i = 0; i < pages; i++) {
      const start = i * pageSize;
      const end = start + pageSize;
      const nextIds = state.slice(start, end).map(entry => entry.blob);
      for (const id of await next(nextIds)) {
        missingIds.push(id);
      }
    }

    return missingIds;
  }

  async queryBranch(branchName: string): Promise<Branch> {
    const resp = await window.fetch(this._location + '?branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-ID': this._sessionId },
      body: JSON.stringify(
        {
          query: `
          query ($projectId: ID!, $branch: String!) {
            branch(project: $projectId, name: $branch) {
              created
              modified
              name
              snapshots
            }
          }
        `,
          variables: {
            projectId: this._project,
            branch: branchName,
          },
        },
        null,
        2,
      ),
    });

    const { data, errors } = await resp.json();
    if (errors && errors.length) {
      throw new Error('Failed to fetch branch');
    }

    return data.branch;
  }

  async queryPushSnapshot(snapshot: Snapshot): Promise<void> {
    const branch = await this._getCurrentBranch();
    const resp = await window.fetch(this._location + '?snapshotPush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-ID': this._sessionId },
      body: JSON.stringify(
        {
          query: `
          mutation ($projectId: ID!, $snapshot: SnapshotInput!, $branchName: String!) {
            snapshotCreate(project: $projectId, snapshot: $snapshot, branch: $branchName) {
              id
            }
          }
        `,
          variables: {
            branchName: branch.name,
            projectId: this._project,
            snapshot,
          },
        },
        null,
        2,
      ),
    });

    const { data, errors } = await resp.json();
    if (errors && errors.length) {
      throw new Error('Failed to push snapshot: ' + JSON.stringify(errors));
    }

    console.log('[sync] Pushed snapshot', data.snapshotCreate.id);
  }

  async queryPushBlobs(allIds: Array<string>): Promise<void> {
    const next = async (ids: Array<string>) => {
      const blobs = [];
      for (const id of ids) {
        const content = await this.getBlobRaw(id);
        if (content === null) {
          throw new Error(`Failed to get blob id=${id}`);
        }
        blobs.push({ id, content: content.toString('base64') });
      }

      const resp = await window.fetch(this._location + '?blobsCreate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': this._sessionId,
        },
        body: JSON.stringify(
          {
            query: `
          mutation ($projectId: ID!, $blobs: [BlobInput!]!) {
            blobsCreate(project: $projectId, blobs: $blobs) {
              count
            }
          }
        `,
            variables: {
              blobs,
              projectId: this._project,
            },
          },
          null,
          2,
        ),
      });

      const { data, errors } = await resp.json();
      if (errors && errors.length) {
        throw new Error('Failed to upload blob');
      }

      return data.blobsCreate.count;
    };

    // Push each missing blob in batches
    const batchSize = 20;
    let count = 0;
    let batch = [];
    for (let i = 0; i < allIds.length; i++) {
      batch.push(allIds[i]);
      if (batch.length > batchSize || i === allIds.length - 1) {
        count += await next(batch);
        batch = [];
      }
    }

    console.log('[sync] Uploaded blobs', count);
  }

  async push(): Promise<void> {
    const branch = await this._getCurrentBranch();

    // Check branch history to make sure there are no conflicts
    let lastMatchingIndex = 0;
    const remoteBranch = await this.queryBranch(branch.name);
    for (; lastMatchingIndex < remoteBranch.snapshots.length; lastMatchingIndex++) {
      if (remoteBranch.snapshots[lastMatchingIndex] !== branch.snapshots[lastMatchingIndex]) {
        throw new Error('Remote history conflict!');
      }
    }

    // Get the remaining snapshots to push
    const snapshotIdsToPush = branch.snapshots.slice(lastMatchingIndex);
    if (snapshotIdsToPush.length === 0) {
      throw new Error('Nothing to push');
    }

    // Push each remaining snapshot
    for (const id of snapshotIdsToPush) {
      const snapshot = await this._getSnapshot(id);
      if (snapshot === null) {
        throw new Error(`Failed to get snapshot id=${id}`);
      }

      // Figure out which blobs the backend is missing
      const missingIds = await this.queryBlobsMissing(snapshot.state);
      await this.queryPushBlobs(missingIds);

      await this.queryPushSnapshot(snapshot);
    }
  }

  async _getProject(): Promise<Project | null> {
    return this._store.getItem(_pathProject(this._project));
  }

  async _getHead(): Promise<Head> {
    const head = await this._store.getItem(_pathHead());
    if (head === null) {
      await this._storeHead({ branch: 'master' });
      return this._getHead();
    }

    return head;
  }

  async _getCurrentBranch(): Promise<Branch> {
    const head = await this._getHead();
    return this._getOrCreateBranch(head.branch);
  }

  async _getBranch(name: string): Promise<Branch | null> {
    const p = _pathProjectBranch(this._project, name);
    return this._store.getItem(p);
  }

  async _getOrCreateBranch(name: string): Promise<Branch> {
    const branch = await this._getBranch(name);

    if (branch === null) {
      await this._storeBranch({
        name,
        created: new Date(),
        modified: new Date(),
        snapshots: [],
      });

      return this._getOrCreateBranch(name);
    }

    return branch;
  }

  async _getSnapshot(id: string): Promise<Snapshot | null> {
    const snapshot = await this._store.getItem(_pathProjectSnapshot(this._project, id));
    if (snapshot && typeof snapshot.created === 'string') {
      snapshot.created = new Date(snapshot.created);
    }

    return snapshot;
  }

  async _getLatestSnapshot(branchName: string): Promise<Snapshot | null> {
    const branch = await this._getOrCreateBranch(branchName);
    const snapshots = branch ? branch.snapshots : [];
    const parentId = snapshots.length ? snapshots[snapshots.length - 1] : EMPTY_HASH;
    return this._getSnapshot(parentId);
  }

  async _storeSnapshot(snapshot: Snapshot): Promise<void> {
    return this._store.setItem(_pathProjectSnapshot(this._project, snapshot.id), snapshot);
  }

  async _storeBranch(branch: Branch): Promise<void> {
    return this._store.setItem(_pathProjectBranch(this._project, branch.name), branch);
  }

  async _storeHead(head: Head): Promise<void> {
    await this._store.setItem(_pathHead(), head);
  }

  async _storeStage(stage: Stage): Promise<void> {
    await this._store.setItem(_pathStage(), stage);
  }

  async _clearStage(): Promise<void> {
    await this._store.removeItem(_pathStage());
  }
}

function _pathStage(): string {
  return '/stage';
}

function _pathHead(): string {
  return '/head';
}

function _pathProjectBase(projectId: string): string {
  return `/projects/${projectId}/`;
}

function _pathProject(projectId: string): string {
  return `${_pathProjectBase(projectId)}`;
}

function _pathProjectBlobs(projectId: string): string {
  return `${_pathProjectBase(projectId)}blobs/`;
}

function _pathProjectBlob(projectId: string, blobId: string): string {
  const subPath = `${blobId.slice(0, 2)}/${blobId.slice(2)}`;
  return `${_pathProjectBlobs(projectId)}${subPath}`;
}

function _pathProjectSnapshots(projectId: string): string {
  return `${_pathProjectBase(projectId)}snapshots/`;
}

function _pathProjectSnapshot(projectId: string, snapshotId: string): string {
  return `${_pathProjectSnapshots(projectId)}${snapshotId}`;
}

function _pathProjectBranches(projectId: string): string {
  return `${_pathProjectBase(projectId)}branches/`;
}

function _pathProjectBranch(projectId: string, branchName: string): string {
  return `${_pathProjectBranches(projectId)}${branchName}`;
}

function _hashContent(content: any): string {
  return crypto
    .createHash('sha1')
    .update(deterministicStringify(content))
    .digest('hex');
}

/** Generate snapshot ID from hashing parent, project, and state together */
function _generateSnapshotID(
  parentId: string,
  projectId: string,
  branchName: string,
  state: Array<SnapshotStateEntry>,
): string {
  const hash = crypto
    .createHash('sha1')
    .update(projectId)
    .update(branchName)
    .update(parentId);

  const newState = [...state].sort((a, b) => (a.blob > b.blob ? 1 : -1));

  for (const entry of newState) {
    hash.update(entry.blob);
  }

  return hash.digest('hex');
}
