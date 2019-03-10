// @flow

import type { BaseDriver } from '../store/drivers/base';
import Store from '../store';
import crypto from 'crypto';
import compress from '../store/hooks/compress';
import * as paths from './paths';
import { jsonHash } from '../lib/jsonHash';
import type {
  Branch,
  DocumentKey,
  Head,
  Project,
  Snapshot,
  SnapshotState,
  Stage,
  StageEntry,
  Status,
  StatusCandidate,
} from '../types';
import { combinedMapKeys, generateCandidateMap, generateStateMap } from './snapshots';

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

    const unstaged: { [DocumentKey]: StageEntry } = {};

    const stateMap = generateStateMap(snapshot);

    for (const { key, name, content } of candidates) {
      const blob = jsonHash(content);

      // Already staged
      if (stage[key] && stage[key].blob === blob) {
        continue;
      }

      // Unchanged so don't care
      if (stateMap[key] && stateMap[key].blob === blob) {
        continue;
      }

      const alreadyExisted = stateMap.hasOwnProperty(key);
      if (alreadyExisted) {
        unstaged[key] = { key, name, blob, content, modified: true };
      } else {
        unstaged[key] = { key, name, blob, content, added: true };
      }
    }

    // Find deleted items
    for (const key of Object.keys(stateMap)) {
      const isAlreadyStaged = stage.hasOwnProperty(key);
      if (isAlreadyStaged) {
        continue;
      }

      const wasNotDeleted = candidates.findIndex(c => c.key === key) >= 0;
      if (wasNotDeleted) {
        continue;
      }

      const { name } = stateMap[key];
      unstaged[key] = { key, name, deleted: true };
    }

    const status: Status = {
      stage,
      unstaged,
      key: '',
    };

    status.key = jsonHash(status);

    return status;
  }

  async getStage(): Promise<Stage> {
    const stage = await this._store.getItem(paths.stage());
    return stage || {};
  }

  async stage(candidates: Array<StageEntry>): Promise<Stage> {
    const stage: Stage = await this.getStage();

    const blobsToStore: { [string]: Object } = {};
    for (const candidate of candidates) {
      stage[candidate.key] = candidate;

      // Only store blobs if we're not deleting it
      if (candidate.added || candidate.modified) {
        blobsToStore[candidate.blob] = candidate.content;
      }
    }

    await this._storeBlobs(blobsToStore);

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

  async fork(newBranchName: string): Promise<void> {
    if (await this._getBranch(newBranchName)) {
      throw new Error('Branch already exists by name ' + newBranchName);
    }

    const newBranch: Branch = {
      name: newBranchName,
      created: new Date(),
      modified: new Date(),
      snapshots: (await this._getCurrentBranch()).snapshots,
    };

    await this._storeBranch(newBranch);
  }

  async removeBranch(branchName: string): Promise<void> {
    const branchToDelete = await this._assertBranch(branchName);
    const currentBranch = await this._getCurrentBranch();
    if (branchToDelete.name === currentBranch.name) {
      throw new Error('Cannot delete currently-active branch');
    }

    await this._removeBranch(branchToDelete);
  }

  async checkout(branchName: string): Promise<void> {
    const branch = await this._getOrCreateBranch(branchName);
    await this._storeHead({ branch: branch.name });
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

    const candidateMap = generateCandidateMap(candidates);
    const currentStateMap = generateStateMap(currentLatestSnapshot);

    const result = {
      deleted: [],
      added: [],
      updated: [],
    };

    const updatedBlobIds = [];
    const addedBlobIds = [];

    for (const key of combinedMapKeys(candidateMap, currentStateMap)) {
      const candidate = candidateMap[key];
      const entry = currentStateMap[key];

      if (!candidate && !entry) {
        throw new Error('Should never happen');
      }

      // In history but not in candidates, so add
      if (!candidate) {
        addedBlobIds.push(entry.blob);
        continue;
      }

      // Not in history so delete
      if (!entry) {
        result.deleted.push(key);
        continue;
      }

      const blobId: string | null = candidate ? jsonHash(candidate.content) : null;
      if (blobId !== null && entry.blob !== blobId) {
        updatedBlobIds.push(entry.blob);
      }
    }

    result.updated = await this._getBlobs(updatedBlobIds);
    result.added = await this._getBlobs(addedBlobIds);

    return result;
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
    const branch = await this._getCurrentBranch();
    return branch.name;
  }

  async getBranches(): Promise<Array<string>> {
    const branches = [];
    for (const p of await this._store.keys(paths.branches(this._project))) {
      const b = await this._store.getItem(p);
      if (b === null) {
        // Should never happen
        throw new Error(`Failed to get branch path=${p}`);
      }

      branches.push(b.name);
    }

    return branches;
  }

  async merge(otherBranchName: string): Promise<void> {
    const otherBranch = await this._assertBranch(otherBranchName);

    const otherSnapshot = await this._getLatestSnapshot(otherBranch.name);
    if (otherSnapshot === null) {
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

    const currentSnapshot = await this._getLatestSnapshot(branch.name);
    if (otherSnapshot && otherSnapshot.id === rootSnapshot.id) {
      // Other branch has a history that is a prefix of the current one
      throw new Error('Entire branch history is already part of this one');
    }

    if (!currentSnapshot || rootSnapshot.id === currentSnapshot.id) {
      branch.snapshots = [...otherBranch.snapshots];
      await this._storeBranch(branch);
      console.log('[sync] Performing fast-forward merge');
      return;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //
    // Obtain necessary things to perform 3-way merge //
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ //

    console.log('[sync] Performing 3-way merge');
    const otherStateMap = generateStateMap(otherSnapshot);
    const rootStateMap = generateStateMap(rootSnapshot);
    const currentStateMap = generateStateMap(currentSnapshot);
    const allKeys = combinedMapKeys(otherStateMap, rootStateMap, currentStateMap);

    // ~~~~~~~~~~~~~~~~~~~ //
    // Perform 3-way merge //
    // ~~~~~~~~~~~~~~~~~~~ //

    const newState: SnapshotState = [];
    for (const key of allKeys) {
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
    await this._createSnapshotFromState(branch, currentSnapshot, newState, name);
    // TODO: Ensure this algorithm accounts for unsaved changes
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

    const newState: SnapshotState = [];

    // Add everything from the old state to the new state (except deleted)
    const parentState = parent ? parent.state : [];
    for (const entry of parentState) {
      if (!stage[entry.key] || !stage[entry.key].deleted) {
        newState.push(entry);
      }
    }

    // Add the rest of the staged items
    for (const key of Object.keys(stage)) {
      const entry = stage[key];
      if (entry.deleted) {
        continue;
      }

      const { name, blob } = entry;
      newState.push({ key, name, blob });
    }

    await this._createSnapshotFromState(branch, parent, newState, name);
  }

  async _createSnapshotFromState(
    branch: Branch,
    parent: Snapshot | null,
    state: SnapshotState,
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

    // Update the branch history
    branch.modified = new Date();
    branch.snapshots.push(snapshot.id);

    await this._storeBranch(branch);
    await this._storeSnapshot(snapshot);
    await this._clearStage();
  }

  async queryBlobsMissing(state: SnapshotState): Promise<Array<string>> {
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
        const content = await this._getBlobRaw(id);
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
    return this._store.getItem(paths.project(this._project));
  }

  async _getHead(): Promise<Head> {
    const head = await this._store.getItem(paths.head());
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

  async _assertBranch(branchName: string): Promise<Branch> {
    const branch = await this._getBranch(branchName);
    if (branch === null) {
      throw new Error(`Branch does not exist with name ${branchName}`);
    }

    return branch;
  }

  async _getBranch(name: string): Promise<Branch | null> {
    const p = paths.branch(this._project, name);
    return this._store.getItem(p);
  }

  async _getOrCreateBranch(name: string): Promise<Branch> {
    if (!name) {
      throw new Error('No branch name specified for get-or-create operation');
    }

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
    const snapshot = await this._store.getItem(paths.snapshot(this._project, id));
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
    return this._store.setItem(paths.snapshot(this._project, snapshot.id), snapshot);
  }

  async _storeBranch(branch: Branch): Promise<void> {
    return this._store.setItem(paths.branch(this._project, branch.name), branch);
  }

  async _removeBranch(branch: Branch): Promise<void> {
    return this._store.removeItem(paths.branch(this._project, branch.name));
  }

  async _storeHead(head: Head): Promise<void> {
    await this._store.setItem(paths.head(), head);
  }

  async _storeStage(stage: Stage): Promise<void> {
    await this._store.setItem(paths.stage(), stage);
  }

  async _clearStage(): Promise<void> {
    await this._store.removeItem(paths.stage());
  }

  async _getBlob(id: string): Promise<Object> {
    const blob = await this._store.getItem(paths.blob(this._project, id));
    if (blob === null) {
      throw new Error(`Failed to retrieve blob id=${id}`);
    }

    return blob;
  }

  async _getBlobs(ids: Array<string>): Promise<Array<Object>> {
    const promises = [];
    for (const id of ids) {
      const p = paths.blob(this._project, id);
      promises.push(this._store.getItem(p));
    }

    return Promise.all(promises);
  }

  async _storeBlob(id: string, content: Object | null): Promise<void> {
    if (!id || id === EMPTY_HASH) {
      return;
    }

    return this._store.setItem(paths.blob(this._project, id), content);
  }

  async _storeBlobs(map: { [string]: Object }): Promise<void> {
    const promises = [];
    for (const id of Object.keys(map)) {
      promises.push(this._storeBlob(id, map[id]));
    }

    await Promise.all(promises);
  }

  async _getBlobRaw(id: string): Promise<Buffer | null> {
    if (!id || id === EMPTY_HASH) {
      return null;
    }

    return this._store.getItemRaw(paths.blob(this._project, id));
  }
}

/** Generate snapshot ID from hashing parent, project, and state together */
function _generateSnapshotID(parentId: string, projectId: string, state: SnapshotState): string {
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
