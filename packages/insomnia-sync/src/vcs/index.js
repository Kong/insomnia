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

type StageEntry = {|
  key: string,
  operation: Operation,
  name: string,
  blob: BlobId,
  content: Object | null,
|};

type Stage = {
  [DocumentKey]: StageEntry,
};

type StatusCandidate = {|
  key: DocumentKey,
  name: string,
  content: Object,
|};

type Status = {|
  stage: Stage,
  unstaged: {
    [DocumentKey]: StageEntry,
  },
|};

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
  }

  async status(candidates: Array<StatusCandidate>): Promise<Status> {
    const stage: Stage = await this.getStage();
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);
    const snapshotState = snapshot ? snapshot.state : [];

    const status: Status = {
      stage,
      unstaged: {},
    };

    const stateMap = {};
    const candidatesMap = {};

    for (const entry of snapshotState) {
      stateMap[entry.key] = entry;
    }

    for (const candidate of candidates) {
      candidatesMap[candidate.key] = candidate;
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
        operation = 'modify';
      } else {
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
      const item = candidatesMap[stateEntry.key];
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

  async stage(candidates: Array<StageEntry>): Promise<Stage> {
    const stage: Stage = await this.getStage();

    const promises = [];
    for (const candidate of candidates) {
      stage[candidate.key] = candidate;

      // Only store blobs if content exists
      // TODO: Make this less weird
      if (candidate.content !== null) {
        promises.push(this.storeBlob(candidate.blob, candidate.content));
      }
    }

    await Promise.all(promises);

    // Store the stage
    await this._storeStage(stage);
    return stage;
  }

  async unstage(candidates: Array<StatusCandidate>): Promise<Stage> {
    const stage = await this.getStage();

    for (const candidate of candidates) {
      delete stage[candidate.key];
    }

    // Store the stage
    await this._storeStage(stage);
    return stage;
  }

  async _getBlob(id: string): Promise<Object | null> {
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

    const newBranch: Branch = {
      name: newBranchName,
      created: new Date(),
      modified: new Date(),
      snapshots: branch.snapshots,
    };

    await this._storeBranch(newBranch);
    await this.checkout(newBranch.name);
  }

  /**
   * Creates a new branch and switches to it. Will return a list of delta operations so
   * the caller can update their state to match.
   */
  async checkout(branchName: string): Promise<void> {
    const newBranch = await this._getOrCreateBranch(branchName);
    await this._storeHead({ branch: newBranch.name });
  }

  async delta(
    candidates: Array<StatusCandidate>,
  ): Promise<{
    added: Array<Object>,
    updated: Array<Object>,
    deleted: Array<string>,
  }> {
    const currentBranch = await this._getCurrentBranch();
    const currentLatestSnapshot = await this._getLatestSnapshot(currentBranch.name);
    const currentLatestState = currentLatestSnapshot ? currentLatestSnapshot.state : [];

    const allKeys = {};
    const candidateMap: { [DocumentKey]: StatusCandidate } = {};
    const currentLatestStateMap: { [DocumentKey]: SnapshotStateEntry } = {};
    for (const candidate of candidates) {
      allKeys[candidate.key] = true;
      candidateMap[candidate.key] = candidate;
    }

    for (const entry of currentLatestState) {
      allKeys[entry.key] = true;
      currentLatestStateMap[entry.key] = entry;
    }

    const deleted = [];
    const updatedPromises = [];
    const addedPromises = [];

    for (const key of Object.keys(allKeys)) {
      const candidate = candidateMap[key];
      const entry = currentLatestStateMap[key];

      if (!candidate && !entry) {
        throw new Error('Should never happen');
      }

      // In history but not in candidates, so add
      if (!candidate) {
        addedPromises.push(this._getBlob(entry.blob));
        continue;
      }

      // Not in history so delete
      if (!entry) {
        console.log('ADD DELETED', { key, currentLatestSnapshot, currentLatestStateMap });
        deleted.push(key);
        continue;
      }

      const blobId = candidate ? _hashContent(candidate.content) : null;
      if (entry.blob !== blobId) {
        updatedPromises.push(this._getBlob(entry.blob));
      }
    }

    return {
      deleted,
      added: await Promise.all(addedPromises),
      updated: await Promise.all(updatedPromises),
    };
  }

  async getHistory(): Promise<Array<Snapshot>> {
    const branch = await this._getCurrentBranch();
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

  async getBranch(): Promise<string> {
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

  async merge(otherBranchName: string): Promise<void> {
    const otherBranch = await this._getBranch(otherBranchName);
    if (otherBranch === null) {
      throw new Error(`Cannot find branch to merge name=${otherBranchName}`);
    }

    const otherLatestSnapshot = await this._getLatestSnapshot(otherBranchName);
    if (otherLatestSnapshot === null) {
      throw new Error('No snapshots found to merge');
    }

    const branch = await this._getCurrentBranch();

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
    // Locate the nearest shared snapshot //
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

    let rootSnapshotId = '';
    for (let i = 0; i < Math.min(branch.snapshots.length, otherBranch.snapshots.length); i++) {
      if (branch.snapshots[i] !== otherBranch.snapshots[i]) {
        break;
      }

      rootSnapshotId = branch.snapshots[i];
    }

    const rootSnapshot = await this._getSnapshot(rootSnapshotId);
    if (rootSnapshot === null) {
      // TODO: Handle this case better
      throw new Error('Branches do not share a history');
    }

    // ~~~~~~~~~~~~~~~~~~~~~~ //
    // Check for fast-forward //
    // ~~~~~~~~~~~~~~~~~~~~~~ //

    const latestSnapshot = await this._getLatestSnapshot(branch.name);
    if (otherLatestSnapshot && otherLatestSnapshot.id === rootSnapshot.id) {
      // Other branch has a history that is a prefix of the current one
      throw new Error('Entire branch history is already part of this one');
    }

    if (!latestSnapshot || rootSnapshot.id === latestSnapshot.id) {
      branch.snapshots = [...otherBranch.snapshots];
      await this._storeBranch(branch);
      console.log('[sync] Performing fast-forward merge');
      return;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
    // Obtain necessary things to perform 3-way merge //
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

    console.log('Performing 3-way merge');
    const allKeys: { [DocumentKey]: boolean } = {};
    const otherStateMap: { [DocumentKey]: SnapshotStateEntry } = {};
    const rootStateMap: { [DocumentKey]: SnapshotStateEntry } = {};
    const currentStateMap: { [DocumentKey]: SnapshotStateEntry } = {};

    for (const entry of latestSnapshot.state) {
      currentStateMap[entry.key] = entry;
      allKeys[entry.key] = true;
    }

    for (const entry of otherLatestSnapshot.state) {
      otherStateMap[entry.key] = entry;
      allKeys[entry.key] = true;
    }

    for (const entry of rootSnapshot.state) {
      rootStateMap[entry.key] = entry;
      allKeys[entry.key] = true;
    }

    // ~~~~~~~~~~~~~~~~~~~ //
    // Perform 3-way merge //
    // ~~~~~~~~~~~~~~~~~~~ //

    const newState: Array<SnapshotStateEntry> = [];
    for (const key of Object.keys(allKeys)) {
      const otherEntry = otherStateMap[key];
      const currentEntry = currentStateMap[key];
      const rootEntry = rootStateMap[key];

      const addedInCurrent = !rootEntry && currentEntry;
      const modifiedInCurrent = rootEntry && currentEntry && currentEntry.key !== rootEntry.key;
      const sameInCurrent = rootEntry && currentEntry && currentEntry.key === rootEntry.key;
      const removedInCurrent = rootEntry && !currentEntry;

      const addedInOther = !rootEntry && otherEntry;
      const modifiedInOther = rootEntry && otherEntry && otherEntry.key !== rootEntry.key;
      const sameInOther = rootEntry && otherEntry && otherEntry.key === rootEntry.key;
      const removedInOther = rootEntry && !otherEntry;

      if (addedInCurrent) {
        if (addedInOther) {
          // TODO: Check conflict
        } else if (modifiedInOther) {
          // Impossible state
        } else if (removedInOther) {
          // Impossible state
        } else if (sameInOther) {
          // Impossible state
        } else if (!otherEntry) {
          newState.push(currentEntry);
        }
      } else if (modifiedInCurrent) {
        if (addedInOther) {
          // Impossible state
        } else if (modifiedInOther) {
          // TODO: Check conflict
        } else if (removedInOther) {
          // TODO: Check conflict
        } else if (sameInOther) {
          newState.push(currentEntry);
        } else if (!otherEntry) {
          newState.push(currentEntry);
        }
      } else if (removedInCurrent) {
        if (addedInOther) {
          // Impossible state
        } else if (modifiedInOther) {
          // TODO: Check conflict
        } else if (removedInOther) {
          // Do nothing, it's removed
        } else if (sameInOther) {
          // Do nothing, it's removed
        } else if (!otherEntry) {
          // Do nothing, it's removed
        }
      } else if (sameInCurrent) {
        if (addedInOther) {
          newState.push(otherEntry);
        } else if (modifiedInOther) {
          newState.push(otherEntry);
        } else if (removedInOther) {
          // Do nothing, it's removed
        } else if (sameInOther) {
          newState.push(otherEntry);
        } else if (!otherEntry) {
          // Impossible state
        }
      } else if (!currentEntry) {
        newState.push(otherEntry);
      }
    }

    const name = `Merged branch ${otherBranch.name}`;
    await this._createSnapshotFromState(branch, latestSnapshot, newState, name);
    // TODO: Ensure this algorithm accouts for unsaved changes
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

    await this._createSnapshotFromState(branch, parent, state, name);
  }

  async _createSnapshotFromState(
    branch: Branch,
    parent: Snapshot | null,
    state: Array<SnapshotStateEntry>,
    name: string,
  ): Promise<void> {
    const parentId: string = parent ? parent.id : EMPTY_HASH;

    // Create the snapshot
    const id = _generateSnapshotID(parentId, this._project, state);
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
  state: Array<SnapshotStateEntry>,
): string {
  const hash = crypto
    .createHash('sha1')
    .update(projectId)
    .update(parentId);

  const newState = [...state].sort((a, b) => (a.blob > b.blob ? 1 : -1));

  for (const entry of newState) {
    hash.update(entry.blob);
  }

  return hash.digest('hex');
}
