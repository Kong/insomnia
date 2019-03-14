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
import {
  generateCandidateMap,
  getRootSnapshot,
  getStagable,
  preMergeCheck,
  stateDelta,
  threeWayMerge,
} from './util';

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
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);
    const state = snapshot ? snapshot.state : [];

    const stage: Stage = await this.getStage();
    const unstaged: { [DocumentKey]: StageEntry } = {};
    for (const entry of getStagable(state, candidates)) {
      const { key } = entry;
      const stageEntry = stage[key];

      if (!stageEntry || stageEntry.blobId !== entry.blobId) {
        unstaged[key] = entry;
      }
    }

    return {
      stage,
      unstaged,
      key: jsonHash({ stage, unstaged }).hash,
    };
  }

  async getStage(): Promise<Stage> {
    const stage = await this._store.getItem(paths.stage(this._project));
    return stage || {};
  }

  async stage(stageEntries: Array<StageEntry>): Promise<Stage> {
    const stage: Stage = await this.getStage();

    const blobsToStore: { [string]: string } = {};
    for (const entry of stageEntries) {
      stage[entry.key] = entry;

      // Only store blobs if we're not deleting it
      if (entry.added || entry.modified) {
        blobsToStore[entry.blobId] = entry.blobContent;
      }
    }

    await this._storeBlobs(blobsToStore);

    // Store the stage
    await this._storeStage(stage);
    return stage;
  }

  async unstage(stageEntries: Array<StatusCandidate>): Promise<Stage> {
    const stage = await this.getStage();

    for (const entry of stageEntries) {
      delete stage[entry.key];
    }

    // Store the stage
    await this._storeStage(stage);
    return stage;
  }

  validateBranchName(branchName: string): string {
    if (!branchName.match(/^[a-zA-Z0-9][a-zA-Z0-9-_.]{3,}$/)) {
      return 'Branch names can only contain letters, numbers, - and _';
    }

    return '';
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

  async checkout(
    candidates: Array<StatusCandidate>,
    branchName: string,
  ): Promise<{
    add: Array<Object>,
    update: Array<Object>,
    remove: Array<Object>,
  }> {
    const branchCurrent = await this._getCurrentBranch();
    const latestSnapshotCurrent: Snapshot | null = await this._getLatestSnapshot(
      branchCurrent.name,
    );
    const latestStateCurrent = latestSnapshotCurrent ? latestSnapshotCurrent.state : [];

    const branchNext = await this._getOrCreateBranch(branchName);
    const latestSnapshotNext: Snapshot | null = await this._getLatestSnapshot(branchNext.name);
    const latestStateNext = latestSnapshotNext ? latestSnapshotNext.state : [];

    // Perform pre-checkout checks
    const { conflicts, dirty } = preMergeCheck(latestStateCurrent, latestStateNext, candidates);
    if (conflicts.length) {
      throw new Error(
        'Cannot checkout with current changes. Please create a snapshot before merging',
      );
    }

    await this._storeHead({ branch: branchNext.name });

    const dirtyMap = generateCandidateMap(dirty);
    const delta = stateDelta(latestStateCurrent, latestStateNext);

    // Filter out things that should stay dirty
    const add = delta.add.filter(e => !dirtyMap[e.key]);
    const update = delta.update.filter(e => !dirtyMap[e.key]);
    const remove = delta.remove.filter(e => !dirtyMap[e.key]);

    // Remove all dirty items from the delta so we keep them around
    return {
      add: await this._getBlobs(add.map(e => e.blob)),
      update: await this._getBlobs(update.map(e => e.blob)),
      remove: await this._getBlobs(remove.map(e => e.blob)),
    };
  }

  async revert(
    candidates: Array<StatusCandidate>,
  ): Promise<{
    add: Array<Object>,
    update: Array<Object>,
    remove: Array<Object>,
  }> {
    const branchCurrent = await this._getCurrentBranch();
    const latestSnapshotCurrent: Snapshot | null = await this._getLatestSnapshot(
      branchCurrent.name,
    );
    const latestStateCurrent = latestSnapshotCurrent ? latestSnapshotCurrent.state : [];

    const potentialNewState: SnapshotState = candidates.map(c => ({
      key: c.key,
      blob: jsonHash(c.document).hash,
      name: c.name,
    }));

    const delta = stateDelta(potentialNewState, latestStateCurrent);

    // We need to treat removals of candidates differently because they may not
    // yet have been stored as blobs.
    const remove = [];
    for (const e of delta.remove) {
      const c = candidates.find(c => c.key === e.key);
      if (!c) {
        // Should never happen
        throw new Error('Failed to find removal in candidates');
      }
      remove.push(c.document);
    }

    return {
      add: await this._getBlobs(delta.add.map(e => e.blob)),
      update: await this._getBlobs(delta.update.map(e => e.blob)),
      remove,
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

  async merge(
    candidates: Array<StatusCandidate>,
    otherBranchName: string,
  ): Promise<{
    add: Array<Object>,
    update: Array<Object>,
    remove: Array<Object>,
  }> {
    const branchOther = await this._assertBranch(otherBranchName);

    const latestSnapshotOther = await this._getLatestSnapshot(branchOther.name);
    if (latestSnapshotOther === null) {
      throw new Error('No snapshots found to merge');
    }

    const branchTrunk = await this._getCurrentBranch();
    const rootSnapshotId = getRootSnapshot(branchTrunk, branchOther);
    const rootSnapshot: Snapshot | null = await this._getSnapshot(rootSnapshotId || 'n/a');
    const latestSnapshotTrunk: Snapshot | null = await this._getLatestSnapshot(branchTrunk.name);

    // Other branch has a history that is a prefix of the current one
    if (latestSnapshotOther.id === rootSnapshotId) {
      throw new Error('Already up to date');
    }

    // Perform 3-way merge
    const rootState = rootSnapshot ? rootSnapshot.state : [];
    const latestStateTrunk = latestSnapshotTrunk ? latestSnapshotTrunk.state : [];
    const latestStateOther = latestSnapshotOther.state;

    // Perform pre-merge checks
    const { conflicts: preConflicts, dirty } = preMergeCheck(
      latestStateTrunk,
      latestStateOther,
      candidates,
    );

    if (preConflicts.length) {
      console.log('[vcs] Merge failed', preConflicts);
      throw new Error('Cannot merge with current changes. Please create a snapshot before merging');
    }

    console.log('[sync] Performing 3-way merge');
    const { state, conflicts: mergeConflicts } = threeWayMerge(
      rootState,
      latestStateTrunk,
      latestStateOther,
    );

    if (mergeConflicts.length) {
      throw new Error('Conflicting keys! ' + mergeConflicts.join(', '));
    }

    const name = `Merged branch ${branchOther.name}`;
    const newSnapshot = await this._createSnapshotFromState(
      branchTrunk,
      latestSnapshotTrunk,
      state,
      name,
    );

    const dirtyMap = generateCandidateMap(dirty);
    const { add, update, remove } = stateDelta(latestStateTrunk, newSnapshot.state);

    // Remove all dirty items from the delta so we keep them around
    return {
      add: await this._getBlobs(add.filter(e => !dirtyMap[e.key]).map(e => e.key)),
      update: await this._getBlobs(update.filter(e => !dirtyMap[e.key]).map(e => e.key)),
      remove: await this._getBlobs(remove.filter(e => !dirtyMap[e.key]).map(e => e.key)),
    };
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

      const { name, blobId: blob } = entry;
      newState.push({ key, name, blob });
    }

    await this._createSnapshotFromState(branch, parent, newState, name);
  }

  async _createSnapshotFromState(
    branch: Branch,
    parent: Snapshot | null,
    state: SnapshotState,
    name: string,
  ): Promise<Snapshot> {
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

    return snapshot;
  }

  async queryBlobsMissing(state: SnapshotState): Promise<Array<string>> {
    const next = async (ids: Array<string>) => {
      const { blobsMissing } = await this._runGraphQL(
        `
          query ($projectId: ID!, $ids: [ID!]!) {
            blobsMissing(project: $projectId, ids: $ids) {
              missing 
            }
          }
        `,
        {
          ids,
          projectId: this._project,
        },
        'missingBlobs',
      );
      return blobsMissing.missing;
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
    const { branch } = await this._runGraphQL(
      `
      query ($projectId: ID!, $branch: String!) {
        branch(project: $projectId, name: $branch) {
          created
          modified
          name
          snapshots
        }
      }`,
      {
        projectId: this._project,
        branch: branchName,
      },
      'branch',
    );

    return branch;
  }

  async queryPushSnapshot(snapshot: Snapshot): Promise<void> {
    const branch = await this._getCurrentBranch();
    const { snapshotCreate } = await this._runGraphQL(
      `
        mutation ($projectId: ID!, $snapshot: SnapshotInput!, $branchName: String!) {
          snapshotCreate(project: $projectId, snapshot: $snapshot, branch: $branchName) {
            id
          }
        }
      `,
      {
        branchName: branch.name,
        projectId: this._project,
        snapshot,
      },
      'snapshotPush',
    );

    console.log('[sync] Pushed snapshot', snapshotCreate.id);
  }

  async queryPushBlobs(allIds: Array<string>): Promise<void> {
    const next = async (items: Array<{ id: string, content: Buffer }>) => {
      const encodedBlobs = items.map(i => ({
        id: i.id,
        content: i.content.toString('base64'),
      }));

      const { blobsCreate } = await this._runGraphQL(
        `
          mutation ($projectId: ID!, $blobs: [BlobInput!]!) {
            blobsCreate(project: $projectId, blobs: $blobs) {
              count
            }
          }
        `,
        {
          blobs: encodedBlobs,
          projectId: this._project,
        },
        'blobsCreate',
      );

      return blobsCreate.count;
    };

    // Push each missing blob in batches of 2MB max
    let count = 0;
    let batch = [];
    let batchSizeBytes = 0;
    const maxBatchSize = 1024 * 1024 * 2; // 2 MB
    for (let i = 0; i < allIds.length; i++) {
      const id = allIds[i];
      const content = await this._getBlobRaw(id);
      if (content === null) {
        throw new Error(`Failed to get blob id=${id}`);
      }

      batch.push({ id, content });
      batchSizeBytes += content.length;
      const isLastId = i === allIds.length - 1;
      if (batchSizeBytes > maxBatchSize || isLastId) {
        count += await next(batch);
        const batchSizeMB = Math.round((batchSizeBytes / 1024 / 1024) * 100) / 100;
        console.log(`[sync] Uploaded ${count}/${allIds.length} blobs in batch ${batchSizeMB}MB`);
        batch = [];
        batchSizeBytes = 0;
      }
    }

    console.log(`[sync] Finished uploading ${count}/${allIds.length} blobs`);
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

  async _runGraphQL(query: string, variables: { [string]: any }, name: string): Promise<Object> {
    const resp = await window.fetch(this._location + '?' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-ID': this._sessionId },
      body: JSON.stringify({ query, variables }, null, 2),
    });

    const { data, errors } = await resp.json();
    if (errors && errors.length) {
      throw new Error(`Failed to query ${name}`);
    }

    return data;
  }

  async _getProject(): Promise<Project | null> {
    return this._store.getItem(paths.project(this._project));
  }

  async _getHead(): Promise<Head> {
    const head = await this._store.getItem(paths.head(this._project));
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
    const errMsg = this.validateBranchName(branch.name);
    if (errMsg) {
      throw new Error(errMsg);
    }

    return this._store.setItem(paths.branch(this._project, branch.name.toLowerCase()), branch);
  }

  async _removeBranch(branch: Branch): Promise<void> {
    return this._store.removeItem(paths.branch(this._project, branch.name));
  }

  async _storeHead(head: Head): Promise<void> {
    await this._store.setItem(paths.head(this._project), head);
  }

  async _storeStage(stage: Stage): Promise<void> {
    await this._store.setItem(paths.stage(this._project), stage);
  }

  async _clearStage(): Promise<void> {
    await this._store.removeItem(paths.stage(this._project));
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

  async _storeBlobs(map: { [string]: string }): Promise<void> {
    const promises = [];
    for (const id of Object.keys(map)) {
      const buff = Buffer.from(map[id], 'utf8');
      promises.push(this._storeBlob(id, buff));
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
