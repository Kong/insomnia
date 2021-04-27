// @flow

import type { BaseDriver } from '../store/drivers/base';
import path from 'path';
import clone from 'clone';
import Store from '../store';
import crypto from 'crypto';
import compress from '../store/hooks/compress';
import * as paths from './paths';
import type {
  Branch,
  DocumentKey,
  Head,
  MergeConflict,
  Project,
  Snapshot,
  SnapshotState,
  Stage,
  StageEntry,
  Status,
  StatusCandidate,
  Team,
} from '../types';
import {
  compareBranches,
  generateCandidateMap,
  getRootSnapshot,
  getStagable,
  hashDocument,
  preMergeCheck,
  stateDelta,
  threeWayMerge,
  updateStateWithConflictResolutions,
} from './util';
import { chunkArray, generateId } from '../../common/misc';
import * as crypt from '../../account/crypt';
import * as session from '../../account/session';
import * as fetch from '../../account/fetch';
import { strings } from '../../common/strings';

const EMPTY_HASH = crypto
  .createHash('sha1')
  .digest('hex')
  .replace(/./g, '0');

type ConflictHandler = (conflicts: Array<MergeConflict>) => Promise<Array<MergeConflict>>;

export default class VCS {
  _store: Store;
  _driver: BaseDriver;
  _project: Project | null;
  _conflictHandler: ?ConflictHandler;

  constructor(driver: BaseDriver, conflictHandler?: ConflictHandler) {
    this._store = new Store(driver, [compress]);
    this._conflictHandler = conflictHandler;
    this._driver = driver;

    // To be set later
    this._project = null;
  }

  newInstance(): VCS {
    const newVCS: VCS = (Object.assign({}, this): any);
    Object.setPrototypeOf(newVCS, VCS.prototype);
    return newVCS;
  }

  async setProject(project: Project): Promise<void> {
    this._project = project;
    console.log(`[sync] Activated project ${project.id}`);

    // Store it because it might not be yet
    await this._storeProject(project);
  }

  hasProject(): boolean {
    return this._project !== null;
  }

  async removeProjectsForRoot(rootDocumentId: string): Promise<void> {
    const all = await this._allProjects();
    const toRemove = all.filter(p => p.rootDocumentId === rootDocumentId);
    for (const project of toRemove) {
      await this._removeProject(project);
    }
  }

  async archiveProject(): Promise<void> {
    const projectId = this._projectId();
    await this._queryProjectArchive(projectId);
    await this._store.removeItem(paths.project(projectId));
    this._project = null;
  }

  async switchProject(rootDocumentId: string): Promise<void> {
    const project = await this._getProjectByRootDocument(rootDocumentId);
    if (project !== null) {
      await this.setProject(project);
    } else {
      this._project = null;
    }
  }

  async switchAndCreateProjectIfNotExist(rootDocumentId: string, name: string): Promise<void> {
    const project = await this._getOrCreateProjectByRootDocument(rootDocumentId, name);
    await this.setProject(project);
  }

  async teams(): Promise<Array<Team>> {
    return this._queryTeams();
  }

  async projectTeams(): Promise<Array<Team>> {
    return this._queryProjectTeams();
  }

  async localProjects(): Promise<Array<Project>> {
    return this._allProjects();
  }

  async remoteProjects(): Promise<Array<Project>> {
    return this._queryProjects();
  }

  async blobFromLastSnapshot(key: string): Promise<Object | null> {
    const branch = await this._getCurrentBranch();
    const snapshot = await this._getLatestSnapshot(branch.name);
    if (!snapshot) {
      return null;
    }

    const entry = snapshot.state.find(e => e.key === key);
    if (!entry) {
      return null;
    }

    return this._getBlob(entry.blob);
  }

  async status(candidates: Array<StatusCandidate>, baseStage: Stage): Promise<Status> {
    const stage = clone(baseStage);
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);
    const state = snapshot ? snapshot.state : [];

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
      key: hashDocument({ stage, unstaged }).hash,
    };
  }

  async stage(stage: Stage, stageEntries: Array<StageEntry>): Promise<Stage> {
    const blobsToStore: { [string]: string } = {};
    for (const entry of stageEntries) {
      stage[entry.key] = entry;

      // Only store blobs if we're not deleting it
      if (entry.added || entry.modified) {
        blobsToStore[entry.blobId] = entry.blobContent;
      }
    }

    await this._storeBlobs(blobsToStore);
    console.log(`[sync] Staged ${stageEntries.map(e => e.name).join(', ')}`);

    return stage;
  }

  async unstage(stage: Stage, stageEntries: Array<StageEntry>): Promise<Stage> {
    for (const entry of stageEntries) {
      delete stage[entry.key];
    }

    console.log(`[sync] Unstaged ${stageEntries.map(e => e.name).join(', ')}`);
    return stage;
  }

  static validateBranchName(branchName: string): string {
    if (!branchName.match(/^[a-zA-Z0-9][a-zA-Z0-9-_.]{2,}$/)) {
      return (
        'Branch names must be at least 3 characters long and can only contain ' +
        'letters, numbers, - and _'
      );
    }

    return '';
  }

  async compareRemoteBranch(): Promise<{ ahead: number, behind: number }> {
    const localBranch = await this._getCurrentBranch();
    const remoteBranch = await this._queryBranch(localBranch.name);
    return compareBranches(localBranch, remoteBranch);
  }

  async fork(newBranchName: string): Promise<void> {
    const branch = await this._getCurrentBranch();
    const errMsg = VCS.validateBranchName(newBranchName);
    if (errMsg) {
      throw new Error(errMsg);
    }

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

    console.log(`[sync] Forked ${branch.name} to ${newBranchName}`);
  }

  async removeRemoteBranch(branchName: string): Promise<void> {
    if (branchName === 'master') {
      throw new Error('Cannot delete master branch');
    }

    await this._queryRemoveBranch(branchName);
    console.log(`[sync] Deleted remote branch ${branchName}`);
  }

  async removeBranch(branchName: string): Promise<void> {
    const branchToDelete = await this._assertBranch(branchName);
    const currentBranch = await this._getCurrentBranch();

    if (branchToDelete.name === 'master') {
      throw new Error('Cannot delete master branch');
    }

    if (branchToDelete.name === currentBranch.name) {
      throw new Error('Cannot delete currently-active branch');
    }

    await this._removeBranch(branchToDelete);
    console.log(`[sync] Deleted local branch ${branchName}`);
  }

  async checkout(
    candidates: Array<StatusCandidate>,
    branchName: string,
  ): Promise<{
    upsert: Array<Object>,
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
      throw new Error('Please snapshot current changes before switching branches');
    }

    await this._storeHead({ branch: branchNext.name });

    const dirtyMap = generateCandidateMap(dirty);
    const delta = stateDelta(latestStateCurrent, latestStateNext);

    // Filter out things that should stay dirty
    const add = delta.add.filter(e => !dirtyMap[e.key]);
    const update = delta.update.filter(e => !dirtyMap[e.key]);
    const remove = delta.remove.filter(e => !dirtyMap[e.key]);
    const upsert = [...add, ...update];
    console.log(`[sync] Switched to branch ${branchName}`);

    // Remove all dirty items from the delta so we keep them around
    return {
      upsert: await this._getBlobs(upsert.map(e => e.blob)),
      remove: await this._getBlobs(remove.map(e => e.blob)),
    };
  }

  async handleAnyConflicts(
    conflicts: Array<MergeConflict>,
    errorMsg: string,
  ): Promise<Array<MergeConflict>> {
    if (conflicts.length === 0) {
      return conflicts;
    }

    if (!this._conflictHandler) {
      throw new Error(errorMsg);
    }

    return this._conflictHandler(conflicts);
  }

  async allDocuments(): Promise<Object> {
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);
    if (!snapshot) {
      throw new Error('Failed to get latest snapshot for all documents');
    }

    return this._getBlobs(snapshot.state.map(s => s.blob));
  }

  async rollbackToLatest(
    candidates: Array<StatusCandidate>,
  ): Promise<{
    upsert: Array<Object>,
    remove: Array<Object>,
  }> {
    const branch = await this._getCurrentBranch();
    const latestSnapshot = await this._getLatestSnapshot(branch.name);
    if (!latestSnapshot) {
      throw new Error('No snapshots to rollback to');
    }

    return this.rollback(latestSnapshot.id, candidates);
  }

  async rollback(
    snapshotId: string,
    candidates: Array<StatusCandidate>,
  ): Promise<{
    upsert: Array<Object>,
    remove: Array<Object>,
  }> {
    const rollbackSnapshot: Snapshot | null = await this._getSnapshot(snapshotId);
    if (rollbackSnapshot === null) {
      throw new Error(`Failed to find snapshot by id ${snapshotId}`);
    }

    const potentialNewState: SnapshotState = candidates.map(c => ({
      key: c.key,
      blob: hashDocument(c.document).hash,
      name: c.name,
    }));

    const delta = stateDelta(potentialNewState, rollbackSnapshot.state);

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

    console.log(`[sync] Rolled back to ${snapshotId}`);

    const upsert = [...delta.update, ...delta.add];
    return {
      upsert: await this._getBlobs(upsert.map(e => e.blob)),
      remove,
    };
  }

  async getHistoryCount(branchName?: string): Promise<number> {
    const branch = branchName ? await this._getBranch(branchName) : await this._getCurrentBranch();
    return branch.snapshots.length;
  }

  async getHistory(count: number = 0): Promise<Array<Snapshot>> {
    const branch = await this._getCurrentBranch();
    const snapshots = [];

    const total = branch.snapshots.length;
    const slice = count <= 0 || count > total ? 0 : total - count;

    for (const id of branch.snapshots.slice(slice)) {
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

  async getRemoteBranches(): Promise<Array<string>> {
    const branches = await this._queryBranches();
    return branches.map(b => b.name);
  }

  async getBranches(): Promise<Array<string>> {
    const branches = await this._getBranches();
    return branches.map(b => b.name);
  }

  async merge(
    candidates: Array<StatusCandidate>,
    otherBranchName: string,
    snapshotMessage?: string,
  ): Promise<{
    upsert: Array<Object>,
    remove: Array<Object>,
  }> {
    const branch = await this._getCurrentBranch();
    console.log(`[sync] Merged branch ${otherBranchName} into ${branch.name}`);
    return this._merge(candidates, branch.name, otherBranchName, snapshotMessage);
  }

  async takeSnapshot(stage: Stage, name: string): Promise<void> {
    const branch: Branch = await this._getCurrentBranch();
    const parent: Snapshot | null = await this._getLatestSnapshot(branch.name);

    if (!name) {
      throw new Error('Snapshot must have a message');
    }

    // Ensure there is something on the stage
    if (Object.keys(stage).length === 0) {
      throw new Error('Snapshot does not have any changes');
    }

    const newState: SnapshotState = [];

    // Add everything from the old state
    for (const entry of parent ? parent.state : []) {
      // Don't add anything that's in the stage (this covers deleted things too :])
      if (stage[entry.key]) {
        continue;
      }

      newState.push(entry);
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

    const snapshot = await this._createSnapshotFromState(branch, newState, name);
    console.log(`[sync] Created snapshot ${snapshot.id} (${name})`);
  }

  async pull(
    candidates: Array<StatusCandidate>,
  ): Promise<{
    upsert: Array<Object>,
    remove: Array<Object>,
  }> {
    await this._getOrCreateRemoteProject();

    const localBranch = await this._getCurrentBranch();
    const tmpBranchForRemote = await this._fetch(localBranch.name + '.hidden', localBranch.name);

    // Merge branch and ensure that we use the remote's history when merging
    const message = `Synced latest changes from ${localBranch.name}`;
    const delta = await this._merge(
      candidates,
      localBranch.name,
      tmpBranchForRemote.name,
      message,
      true,
    );

    // Remove tmp branch
    await this._removeBranch(tmpBranchForRemote);
    console.log(`[sync] Pulled branch ${localBranch.name}`);

    return delta;
  }

  async shareWithTeam(teamId: string): Promise<void> {
    const { memberKeys, projectKey } = await this._queryProjectShareInstructions(teamId);
    const { privateKey } = this._assertSession();
    const symmetricKey = crypt.decryptRSAWithJWK(privateKey, projectKey.encSymmetricKey);

    const keys = [];
    for (const { accountId, publicKey } of memberKeys) {
      const encSymmetricKey = crypt.encryptRSAWithJWK(JSON.parse(publicKey), symmetricKey);
      keys.push({ accountId, encSymmetricKey });
    }

    await this._queryProjectShare(teamId, keys);
    console.log(`[sync] Shared project ${this._projectId()} with ${teamId}`);
  }

  async unShareWithTeam(): Promise<void> {
    await this._queryProjectUnShare();
    console.log(`[sync] Unshared project ${this._projectId()}`);
  }

  async _getOrCreateRemoteProject(): Promise<Project> {
    const localProject = await this._assertProject();
    let project = await this._queryProject();
    if (!project) {
      project = await this._queryCreateProject(localProject.rootDocumentId, localProject.name);
    }

    await this._storeProject(project);
    return project;
  }

  async push(): Promise<void> {
    await this._getOrCreateRemoteProject();
    const branch = await this._getCurrentBranch();

    // Check branch history to make sure there are no conflicts
    let lastMatchingIndex = 0;
    const remoteBranch: Branch | null = await this._queryBranch(branch.name);
    const remoteBranchSnapshots = remoteBranch ? remoteBranch.snapshots : [];
    for (; lastMatchingIndex < remoteBranchSnapshots.length; lastMatchingIndex++) {
      if (remoteBranchSnapshots[lastMatchingIndex] !== branch.snapshots[lastMatchingIndex]) {
        throw new Error('Remote history conflict. Please pull latest changes and try again');
      }
    }

    // Get the remaining snapshots to push
    const snapshotIdsToPush = branch.snapshots.slice(lastMatchingIndex);
    if (snapshotIdsToPush.length === 0) {
      throw new Error('Already up to date');
    }

    // Gather a list of snapshot state entries to push
    const allBlobIds = new Set();
    const snapshots = [];
    for (const id of snapshotIdsToPush) {
      const snapshot = await this._assertSnapshot(id);
      snapshots.push(snapshot);

      for (const entry of snapshot.state) {
        allBlobIds.add(entry.blob);
      }
    }

    // Figure out which blobs the backend is missing
    const missingIds = await this._queryBlobsMissing(Array.from(allBlobIds));
    await this._queryPushBlobs(missingIds);
    await this._queryPushSnapshots(snapshots);
  }

  async _fetch(localBranchName: string, remoteBranchName: string): Promise<Branch> {
    const remoteBranch: Branch | null = await this._queryBranch(remoteBranchName);
    if (!remoteBranch) {
      throw new Error(`The remote branch "${remoteBranchName}" does not exist`);
    }

    // Fetch snapshots and blobs from remote branch
    const snapshotsToFetch: Array<string> = [];
    for (const snapshotId of remoteBranch.snapshots) {
      const localSnapshot = await this._getSnapshot(snapshotId);
      if (!localSnapshot) {
        snapshotsToFetch.push(snapshotId);
      }
    }

    // Find blobs to fetch
    const blobsToFetch = new Set();
    const snapshots = await this._querySnapshots(snapshotsToFetch);
    for (const snapshot of snapshots) {
      for (const { blob } of snapshot.state) {
        const hasBlob = await this._hasBlob(blob);
        if (hasBlob) {
          continue;
        }

        blobsToFetch.add(blob);
      }
    }

    // Fetch and store the blobs
    const ids = Array.from(blobsToFetch);
    const blobs = await this._queryBlobs(ids);
    await this._storeBlobsBuffer(blobs);

    // Store the snapshots
    await this._storeSnapshots(snapshots);

    // Create the new branch and save it
    const branch = clone(remoteBranch);
    branch.created = branch.modified = new Date();
    branch.name = localBranchName;
    await this._storeBranch(branch);

    return branch;
  }

  async _merge(
    candidates: Array<StatusCandidate>,
    trunkBranchName: string,
    otherBranchName: string,
    snapshotMessage?: string,
    useOtherBranchHistory?: boolean,
  ): Promise<{
    upsert: Array<Object>,
    remove: Array<Object>,
  }> {
    const branchOther = await this._assertBranch(otherBranchName);
    const latestSnapshotOther: Snapshot | null = await this._getLatestSnapshot(branchOther.name);

    const branchTrunk = await this._assertBranch(trunkBranchName);
    const rootSnapshotId = getRootSnapshot(branchTrunk, branchOther);
    const rootSnapshot: Snapshot | null = await this._getSnapshot(rootSnapshotId || 'n/a');
    const latestSnapshotTrunk: Snapshot | null = await this._getLatestSnapshot(branchTrunk.name);
    const latestStateTrunk = latestSnapshotTrunk ? latestSnapshotTrunk.state : [];
    const latestStateOther = latestSnapshotOther ? latestSnapshotOther.state : [];

    // Perform pre-merge checks
    const { conflicts: preConflicts, dirty } = preMergeCheck(
      latestStateTrunk,
      latestStateOther,
      candidates,
    );

    if (preConflicts.length) {
      console.log('[sync] Merge failed', preConflicts);
      throw new Error('Please snapshot current changes or revert them before merging');
    }

    const shouldDoNothing1 = latestSnapshotOther && latestSnapshotOther.id === rootSnapshotId;
    const shouldDoNothing2 = branchOther.snapshots.length === 0;
    const shouldFastForward1 =
      rootSnapshot && (!latestSnapshotTrunk || rootSnapshot.id === latestSnapshotTrunk.id);
    const shouldFastForward2 = branchTrunk.snapshots.length === 0;

    if (shouldDoNothing1 || shouldDoNothing2) {
      console.log('[sync] Nothing to merge');
    } else if (shouldFastForward1 || shouldFastForward2) {
      console.log('[sync] Performing fast-forward merge');
      branchTrunk.snapshots = branchOther.snapshots;
      await this._storeBranch(branchTrunk);
    } else {
      const rootState = rootSnapshot ? rootSnapshot.state : [];

      console.log('[sync] Performing 3-way merge');
      const { state: stateBeforeConflicts, conflicts: mergeConflicts } = threeWayMerge(
        rootState,
        latestStateTrunk,
        latestStateOther,
      );

      // Update state with conflict resolutions applied
      const conflictResolutions = await this.handleAnyConflicts(mergeConflicts, '');
      const state = updateStateWithConflictResolutions(stateBeforeConflicts, conflictResolutions);

      // Sometimes we want to merge into trunk but keep the other branch's history
      if (useOtherBranchHistory) {
        branchTrunk.snapshots = branchOther.snapshots;
      }

      const snapshotName = snapshotMessage || `Merged branch ${branchOther.name}`;
      await this._createSnapshotFromState(branchTrunk, state, snapshotName);
    }

    const newLatestSnapshot = await this._getLatestSnapshot(branchTrunk.name);
    const newLatestSnapshotState = newLatestSnapshot ? newLatestSnapshot.state : [];

    const { add, update, remove } = stateDelta(latestStateTrunk, newLatestSnapshotState);
    const upsert = [...add, ...update];

    // Remove all dirty items from the delta so we keep them around
    const dirtyMap = generateCandidateMap(dirty);
    return {
      upsert: await this._getBlobs(upsert.filter(e => !dirtyMap[e.key]).map(e => e.blob)),
      remove: await this._getBlobs(remove.filter(e => !dirtyMap[e.key]).map(e => e.blob)),
    };
  }

  async _createSnapshotFromState(
    branch: Branch,
    state: SnapshotState,
    name: string,
  ): Promise<Snapshot> {
    const parentId = branch.snapshots.length
      ? branch.snapshots[branch.snapshots.length - 1]
      : EMPTY_HASH;

    // Create the snapshot
    const id = _generateSnapshotID(parentId, this._projectId(), state);
    const snapshot: Snapshot = {
      id,
      name,
      state,
      author: '', // Will be set when pushed
      parent: parentId,
      created: new Date(),
      description: '',
    };

    // Update the branch history
    branch.modified = new Date();
    branch.snapshots.push(snapshot.id);

    await this._storeBranch(branch);
    await this._storeSnapshot(snapshot);
    console.log(`[sync] Created snapshot '${name}' on ${branch.name}`);

    return snapshot;
  }

  async _runGraphQL(query: string, variables: { [string]: any }, name: string): Promise<Object> {
    const { sessionId } = this._assertSession();
    const { data, errors } = await fetch.post('/graphql?' + name, { query, variables }, sessionId);

    if (errors && errors.length) {
      console.log(`[sync] Failed to query ${name}`, errors);
      throw new Error(`Failed to query ${name}: ${errors[0].message}`);
    }

    return data;
  }

  async _queryBlobsMissing(ids: Array<string>): Promise<Array<string>> {
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
        projectId: this._projectId(),
      },
      'missingBlobs',
    );

    return blobsMissing.missing;
  }

  async _queryBranches(): Promise<Array<Branch>> {
    const { branches } = await this._runGraphQL(
      `
      query ($projectId: ID!) {
        branches(project: $projectId) {
          created
          modified
          name
          snapshots
        }
      }`,
      {
        projectId: this._projectId(),
      },
      'branches',
    );

    // TODO: Fix server returning null instead of empty list
    return branches || [];
  }

  async _queryRemoveBranch(branchName: string): Promise<void> {
    await this._runGraphQL(
      `
      mutation ($projectId: ID!, $branch: String!) {
        branchRemove(project: $projectId, name: $branch)
      }`,
      {
        projectId: this._projectId(),
        branch: branchName,
      },
      'removeBranch',
    );
  }

  async _queryBranch(branchName: string): Promise<Branch | null> {
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
        projectId: this._projectId(),
        branch: branchName,
      },
      'branch',
    );

    return branch;
  }

  async _querySnapshots(allIds: Array<string>): Promise<Array<Snapshot>> {
    let allSnapshots = [];
    for (const ids of chunkArray(allIds, 20)) {
      const { snapshots } = await this._runGraphQL(
        `
        query ($ids: [ID!]!, $projectId: ID!) {
          snapshots(ids: $ids, project: $projectId) {
            id
            parent
            created
            author
            authorAccount {
              firstName
              lastName
              email
            }
            name
            description
            state {
              blob
              key
              name
            }
          }
        }`,
        {
          ids,
          projectId: this._projectId(),
        },
        'snapshots',
      );
      allSnapshots = [...allSnapshots, ...snapshots];
    }

    return allSnapshots;
  }

  async _queryPushSnapshots(allSnapshots: Array<Snapshot>): Promise<void> {
    const { accountId } = this._assertSession();

    for (const snapshots of chunkArray(allSnapshots, 20)) {
      // This bit of logic fills in any missing author IDs from times where
      // the user created snapshots while not logged in
      for (const snapshot of snapshots) {
        if (snapshot.author === '') {
          snapshot.author = accountId;
        }
      }

      const branch = await this._getCurrentBranch();
      const { snapshotsCreate } = await this._runGraphQL(
        `
        mutation ($projectId: ID!, $snapshots: [SnapshotInput!]!, $branchName: String!) {
          snapshotsCreate(project: $projectId, snapshots: $snapshots, branch: $branchName) {
            id
            parent
            created
            author
            authorAccount {
              firstName
              lastName
              email
            }
            name
            description
            state {
              blob
              key
              name
            }
          }
        }
      `,
        {
          branchName: branch.name,
          projectId: this._projectId(),
          snapshots: snapshots.map(s => ({
            created: s.created,
            name: s.name,
            description: s.description,
            parent: s.parent,
            id: s.id,
            author: s.author,
            state: s.state,
          })),
        },
        'snapshotsPush',
      );

      // Store them in case something has changed
      await this._storeSnapshots(snapshotsCreate);

      console.log('[sync] Pushed snapshots', snapshotsCreate.map(s => s.id).join(', '));
    }
  }

  async _queryBlobs(allIds: Array<string>): Promise<{ [string]: Buffer }> {
    const symmetricKey = await this._getProjectSymmetricKey();
    const result = {};

    for (const ids of chunkArray(allIds, 50)) {
      const { blobs } = await this._runGraphQL(
        `
      query ($ids: [ID!]!, $projectId: ID!) {
        blobs(ids: $ids, project: $projectId) {
          id
          content
        }
      }`,
        {
          ids,
          projectId: this._projectId(),
        },
        'blobs',
      );

      for (const blob of blobs) {
        const encryptedResult = JSON.parse(blob.content);
        result[blob.id] = crypt.decryptAESToBuffer(symmetricKey, encryptedResult);
      }
    }

    return result;
  }

  async _queryPushBlobs(allIds: Array<string>): Promise<void> {
    const symmetricKey = await this._getProjectSymmetricKey();

    const next = async (items: Array<{ id: string, content: string }>) => {
      const encodedBlobs = items.map(i => ({
        id: i.id,
        content: i.content,
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
          projectId: this._projectId(),
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
    const maxBatchCount = 200;
    for (let i = 0; i < allIds.length; i++) {
      const id = allIds[i];
      const content = await this._getBlobRaw(id);
      if (content === null) {
        throw new Error(`Failed to get blob id=${id}`);
      }

      const encryptedResult = crypt.encryptAESBuffer(symmetricKey, content);
      batch.push({ id, content: JSON.stringify(encryptedResult, null, 2) });

      batchSizeBytes += content.length;
      const isLastId = i === allIds.length - 1;
      if (batchSizeBytes > maxBatchSize || isLastId || batch.length >= maxBatchCount) {
        count += await next(batch);
        const batchSizeMB = Math.round((batchSizeBytes / 1024) * 100) / 100;
        console.log(`[sync] Uploaded ${count}/${allIds.length} blobs in batch ${batchSizeMB} KB`);
        batch = [];
        batchSizeBytes = 0;
      }
    }

    console.log(`[sync] Finished uploading ${count}/${allIds.length} blobs`);
  }

  async _queryProjectKey(): Promise<string> {
    const { projectKey } = await this._runGraphQL(
      `
        query ($projectId: ID!) {
          projectKey(projectId: $projectId) {
            encSymmetricKey
          }
        }
      `,
      {
        projectId: this._projectId(),
      },
      'projectKey',
    );

    return projectKey.encSymmetricKey;
  }

  async _queryTeams(): Promise<Array<Team>> {
    const { teams } = await this._runGraphQL(
      `
        query {
          teams {
            id
            name
          }
        }
      `,
      {},
      'teams',
    );

    return teams;
  }

  async _queryProjectUnShare(): Promise<void> {
    await this._runGraphQL(
      `
        mutation ($id: ID!) {
          projectUnShare(id: $id) {
            id
          }
        }
      `,
      {
        id: this._projectId(),
      },
      'projectUnShare',
    );
  }

  async _queryProjectShare(
    teamId: string,
    keys: Array<{ accountId: string, encSymmetricKey: string }>,
  ): Promise<void> {
    await this._runGraphQL(
      `
        mutation ($id: ID!, $teamId: ID!, $keys: [ProjectShareKeyInput!]!) {
          projectShare(teamId: $teamId, id: $id, keys: $keys) {
            id
          }
        }
      `,
      {
        keys,
        teamId,
        id: this._projectId(),
      },
      'projectShare',
    );
  }

  async _queryProjectShareInstructions(
    teamId: string,
  ): Promise<{
    teamId: string,
    projectKey: {
      encSymmetricKey: string,
    },
    memberKeys: Array<{
      accountId: string,
      publicKey: string,
    }>,
  }> {
    const { projectShareInstructions } = await this._runGraphQL(
      `
        query ($id: ID!, $teamId: ID!) {
          projectShareInstructions(teamId: $teamId, id: $id) {
            teamId
            projectKey {
              encSymmetricKey
            }
            memberKeys {
              accountId
              publicKey
            }
          }
        }
      `,
      {
        id: this._projectId(),
        teamId: teamId,
      },
      'projectShareInstructions',
    );

    return projectShareInstructions;
  }

  async _queryProjects(): Promise<Array<Project>> {
    const { projects } = await this._runGraphQL(
      `
        query {
          projects {
            id
            name
            rootDocumentId
          }
        }
      `,
      {},
      'projects',
    );

    return projects;
  }

  async _queryProject(): Promise<Project | null> {
    const { project } = await this._runGraphQL(
      `
        query ($id: ID!) {
          project(id: $id) {
            id
            name
            rootDocumentId
          }
        }
      `,
      {
        id: this._projectId(),
      },
      'project',
    );

    return project;
  }

  async _queryProjectTeams(): Promise<Array<Team>> {
    const { project } = await this._runGraphQL(
      `
      query ($id: ID!) {
        project(id: $id) {
          teams {
            id
            name
          }
        }
      }
    `,
      {
        id: this._projectId(),
      },
      'project.teams',
    );

    if (!project) {
      throw new Error(`Please push the ${strings.collection.toLowerCase()} to be able to share it`);
    }

    return project.teams;
  }

  async _queryCreateProject(workspaceId: string, workspaceName: string): Promise<Project> {
    const { publicKey } = this._assertSession();

    // Generate symmetric key for ResourceGroup
    const symmetricKey = await crypt.generateAES256Key();
    const symmetricKeyStr = JSON.stringify(symmetricKey);

    // Encrypt the symmetric key with Account public key
    const encSymmetricKey = crypt.encryptRSAWithJWK(publicKey, symmetricKeyStr);

    const { projectCreate } = await this._runGraphQL(
      `
        mutation ($rootDocumentId: ID!, $name: String!, $id: ID!, $key: String!) {
          projectCreate(name: $name, id: $id, rootDocumentId: $rootDocumentId, encSymmetricKey: $key) {
            id
            name
            rootDocumentId
          }
        }
      `,
      {
        id: this._projectId(),
        rootDocumentId: workspaceId,
        name: workspaceName,
        key: encSymmetricKey,
      },
      'switchAndCreateProjectIfNotExist',
    );

    console.log(`[sync] Created remote project ${projectCreate.id} (${projectCreate.name})`);

    return projectCreate;
  }

  async _getProject(): Promise<Project | null> {
    const projectId = this._project ? this._project.id : 'n/a';
    return this._store.getItem(paths.project(projectId));
  }

  async _getProjectById(id: string): Promise<Project | null> {
    return this._store.getItem(paths.project(id));
  }

  async _getProjectSymmetricKey(): Promise<Object> {
    const { privateKey } = this._assertSession();
    const encSymmetricKey = await this._queryProjectKey();
    const symmetricKeyStr = crypt.decryptRSAWithJWK(privateKey, encSymmetricKey);
    return JSON.parse(symmetricKeyStr);
  }

  async _assertProject(): Promise<Project> {
    const project = await this._getProject();
    if (project === null) {
      throw new Error('Failed to find local project id=' + this._projectId());
    }

    return project;
  }

  async _storeProject(project: Project): Promise<void> {
    return this._store.setItem(paths.project(project.id), project);
  }

  async _getHead(): Promise<Head> {
    const head = await this._store.getItem(paths.head(this._projectId()));
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

  _assertSession(): {|
    accountId: string,
    sessionId: string,
    privateKey: Object,
    publicKey: Object,
  |} {
    if (!session.isLoggedIn()) {
      throw new Error('Not logged in');
    }

    return {
      accountId: session.getAccountId(),
      sessionId: session.getCurrentSessionId(),
      privateKey: session.getPrivateKey(),
      publicKey: session.getPublicKey(),
    };
  }

  async _assertBranch(branchName: string): Promise<Branch> {
    const branch = await this._getBranch(branchName);
    if (branch === null) {
      throw new Error(`Branch does not exist with name ${branchName}`);
    }

    return branch;
  }

  _projectId(): string {
    if (this._project === null) {
      throw new Error('No active project');
    }

    return this._project.id;
  }

  async _getBranch(name: string, projectId?: string): Promise<Branch | null> {
    const pId = projectId || this._projectId();
    const p = paths.branch(pId, name);
    return this._store.getItem(p);
  }

  async _getBranches(projectId?: string): Promise<Array<Branch>> {
    const branches = [];
    const pId = projectId || this._projectId();
    for (const p of await this._store.keys(paths.branches(pId))) {
      const b = await this._store.getItem(p);
      if (b === null) {
        // Should never happen
        throw new Error(`Failed to get branch path=${p}`);
      }

      branches.push(b);
    }

    return branches;
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

  async _getProjectByRootDocument(rootDocumentId: string): Promise<Project | null> {
    if (!rootDocumentId) {
      throw new Error('No root document ID supplied for project');
    }

    // First, try finding the project
    const projects = await this._allProjects();
    let matchedProjects = projects.filter(p => p.rootDocumentId === rootDocumentId);

    // If there is more than one project for root, try pruning unused ones by branch activity
    if (matchedProjects.length > 1) {
      for (const p of matchedProjects) {
        const branches = await this._getBranches(p.id);
        if (!branches.find(b => b.snapshots.length > 0)) {
          await this._removeProject(p);
          matchedProjects = matchedProjects.filter(({ id }) => id !== p.id);
          console.log(`[sync] Remove inactive project for root ${rootDocumentId}`);
        }
      }
    }

    // If there are still too many, error out
    if (matchedProjects.length > 1) {
      console.log('[sync] Multiple projects matched for root', {
        projects,
        matchedProjects,
        rootDocumentId,
      });
      throw new Error('More than one project matched query');
    }

    return matchedProjects[0] || null;
  }

  async _getOrCreateProjectByRootDocument(rootDocumentId: string, name: string): Promise<Project> {
    let project: Project | null = await this._getProjectByRootDocument(rootDocumentId);

    // If we still don't have a project, create one
    if (!project) {
      const id = generateId('prj');
      project = { id, name, rootDocumentId };
      await this._storeProject(project);
      console.log(`[sync] Created project ${project.id}`);
    }

    return project;
  }

  async _allProjects(): Promise<Array<Project>> {
    const projects = [];
    const basePath = paths.projects();
    const keys = await this._store.keys(basePath, false);
    for (const key of keys) {
      const id = path.basename(key);
      const p: Project | null = await this._getProjectById(id);
      if (p === null) {
        // Folder exists but project meta file is gone
        continue;
      }

      projects.push(p);
    }

    return projects;
  }

  async _assertSnapshot(id: string): Promise<Snapshot> {
    const snapshot = await this._store.getItem(paths.snapshot(this._projectId(), id));
    if (snapshot && typeof snapshot.created === 'string') {
      snapshot.created = new Date(snapshot.created);
    }

    if (!snapshot) {
      throw new Error(`Failed to find snapshot id=${id}`);
    }

    return snapshot;
  }

  async _getSnapshot(id: string): Promise<Snapshot | null> {
    const snapshot = await this._store.getItem(paths.snapshot(this._projectId(), id));
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
    return this._store.setItem(paths.snapshot(this._projectId(), snapshot.id), snapshot);
  }

  async _storeSnapshots(snapshots: Array<Snapshot>): Promise<void> {
    const promises = [];
    for (const snapshot of snapshots) {
      const p = paths.snapshot(this._projectId(), snapshot.id);
      promises.push(this._store.setItem(p, snapshot));
    }

    await Promise.all(promises);
  }

  async _storeBranch(branch: Branch): Promise<void> {
    const errMsg = VCS.validateBranchName(branch.name);
    if (errMsg) {
      throw new Error(errMsg);
    }

    branch.modified = new Date();
    return this._store.setItem(paths.branch(this._projectId(), branch.name.toLowerCase()), branch);
  }

  async _removeBranch(branch: Branch): Promise<void> {
    return this._store.removeItem(paths.branch(this._projectId(), branch.name));
  }

  async _removeProject(project: Project): Promise<void> {
    console.log(`[sync] Remove local project ${project.id}`);
    return this._store.removeItem(paths.project(project.id));
  }

  async _storeHead(head: Head): Promise<void> {
    await this._store.setItem(paths.head(this._projectId()), head);
  }

  async _getBlob(id: string): Promise<Object | null> {
    const p = paths.blob(this._projectId(), id);
    return this._store.getItem(p);
  }

  async _getBlobs(ids: Array<string>): Promise<Array<Object>> {
    const promises = [];
    for (const id of ids) {
      promises.push(this._getBlob(id));
    }

    return Promise.all(promises);
  }

  async _storeBlob(id: string, content: Object | null): Promise<void> {
    return this._store.setItem(paths.blob(this._projectId(), id), content);
  }

  async _storeBlobs(map: { [string]: string }): Promise<void> {
    const promises = [];
    for (const id of Object.keys(map)) {
      const buff = Buffer.from(map[id], 'utf8');
      promises.push(this._storeBlob(id, buff));
    }

    await Promise.all(promises);
  }

  async _storeBlobsBuffer(map: { [string]: Buffer }): Promise<void> {
    const promises = [];
    for (const id of Object.keys(map)) {
      const p = paths.blob(this._projectId(), id);
      promises.push(this._store.setItemRaw(p, map[id]));
    }

    await Promise.all(promises);
  }

  async _getBlobRaw(id: string): Promise<Buffer | null> {
    return this._store.getItemRaw(paths.blob(this._projectId(), id));
  }

  async _hasBlob(id: string): Promise<boolean> {
    return this._store.hasItem(paths.blob(this._projectId(), id));
  }

  async _queryProjectArchive(projectId: string): Promise<void> {
    await this._runGraphQL(
      `
        mutation ($id: ID!) {
          projectArchive(id: $id)
        }
      `,
      {
        id: projectId,
      },
      'projectArchive',
    );

    console.log(`[sync] Archived remote project ${projectId}`);
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
