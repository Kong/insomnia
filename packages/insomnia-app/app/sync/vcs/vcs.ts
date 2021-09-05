import clone from 'clone';
import crypto from 'crypto';
import path from 'path';

import * as crypt from '../../account/crypt';
import * as fetch from '../../account/fetch';
import * as session from '../../account/session';
import { chunkArray, generateId } from '../../common/misc';
import { strings } from '../../common/strings';
import { BaseModel } from '../../models';
import Store from '../store';
import type { BaseDriver } from '../store/drivers/base';
import compress from '../store/hooks/compress';
import type {
  BackendProject,
  Branch,
  DocumentKey,
  Head,
  MergeConflict,
  Snapshot,
  SnapshotState,
  Stage,
  StageEntry,
  StatusCandidate,
  Team,
} from '../types';
import { BackendProjectWithTeams, normalizeBackendProjectTeam } from './normalize-backend-project-team';
import * as paths from './paths';
import {
  compareBranches,
  generateCandidateMap,
  getRootSnapshot,
  getStagable,
  hash,
  hashDocument,
  preMergeCheck,
  stateDelta,
  threeWayMerge,
  updateStateWithConflictResolutions,
} from './util';

const EMPTY_HASH = crypto.createHash('sha1').digest('hex').replace(/./g, '0');

type ConflictHandler = (conflicts: MergeConflict[]) => Promise<MergeConflict[]>;

export class VCS {
  _store: Store;
  _driver: BaseDriver;
  _backendProject: BackendProject | null;
  _conflictHandler?: ConflictHandler | null;

  constructor(driver: BaseDriver, conflictHandler?: ConflictHandler) {
    this._store = new Store(driver, [compress]);
    this._conflictHandler = conflictHandler;
    this._driver = driver;
    // To be set later
    this._backendProject = null;
  }

  newInstance(): VCS {
    const newVCS: VCS = Object.assign({}, this) as any;
    Object.setPrototypeOf(newVCS, VCS.prototype);
    return newVCS;
  }

  async setBackendProject(backendProject: BackendProject) {
    this._backendProject = backendProject;
    console.log(`[sync] Activated project ${backendProject.id}`);
    // Store it because it might not be yet
    await this._storeBackendProject(backendProject);
  }

  hasBackendProject() {
    return this._backendProject !== null;
  }

  async hasBackendProjectForRootDocument(rootDocumentId: string) {
    return Boolean(await this._getBackendProjectByRootDocument(rootDocumentId));
  }

  async removeBackendProjectsForRoot(rootDocumentId: string) {
    const all = await this._allBackendProjects();
    const toRemove = all.filter(p => p.rootDocumentId === rootDocumentId);

    for (const backendProject of toRemove) {
      await this._removeProject(backendProject);
    }
  }

  async archiveProject() {
    const backendProjectId = this._backendProjectId();

    await this._queryProjectArchive(backendProjectId);
    await this._store.removeItem(paths.project(backendProjectId));
    this._backendProject = null;
  }

  clearBackendProject() {
    this._backendProject = null;
  }

  async switchProject(rootDocumentId: string) {
    const backendProject = await this._getBackendProjectByRootDocument(rootDocumentId);

    if (backendProject !== null) {
      await this.setBackendProject(backendProject);
    } else {
      this._backendProject = null;
    }
  }

  async switchAndCreateBackendProjectIfNotExist(rootDocumentId: string, name: string) {
    const project = await this._getOrCreateBackendProjectByRootDocument(rootDocumentId, name);
    await this.setBackendProject(project);
  }

  async teams() {
    return this._queryTeams();
  }

  async backendProjectTeams() {
    return this._queryBackendProjectTeams();
  }

  async localBackendProjects() {
    return this._allBackendProjects();
  }

  async remoteBackendProjects(teamId: string) {
    return this._queryBackendProjects(teamId);
  }

  async remoteBackendProjectsInAnyTeam() {
    return this._queryBackendProjects();
  }

  async blobFromLastSnapshot(key: string) {
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

  async status(candidates: StatusCandidate[], baseStage: Readonly<Stage>) {
    const stage = clone<Stage>(baseStage);
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);
    const state = snapshot ? snapshot.state : [];
    const unstaged: Record<DocumentKey, StageEntry> = {};

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
      key: hash({ stage, unstaged }).hash,
    };
  }

  async stage(baseStage: Readonly<Stage>, stageEntries: StageEntry[]) {
    const stage = clone<Stage>(baseStage);
    const blobsToStore: Record<string, string> = {};

    for (const entry of stageEntries) {
      stage[entry.key] = entry;

      // Only store blobs if we're not deleting it
      // @ts-expect-error -- TSCONVERSION type narrowing
      if (entry.added || entry.modified) {
        // @ts-expect-error -- TSCONVERSION type narrowing
        blobsToStore[entry.blobId] = entry.blobContent;
      }
    }

    await this._storeBlobs(blobsToStore);
    console.log(`[sync] Staged ${stageEntries.map(e => e.name).join(', ')}`);
    return stage;
  }

  async unstage(baseStage: Readonly<Stage>, stageEntries: StageEntry[]) {
    const stage = clone<Stage>(baseStage);
    for (const entry of stageEntries) {
      delete stage[entry.key];
    }

    console.log(`[sync] Unstaged ${stageEntries.map(e => e.name).join(', ')}`);
    return stage;
  }

  static validateBranchName(branchName: string) {
    if (!branchName.match(/^[a-zA-Z0-9][a-zA-Z0-9-_.]{2,}$/)) {
      return (
        'Branch names must be at least 3 characters long and can only contain ' +
        'letters, numbers, - and _'
      );
    }

    return '';
  }

  async compareRemoteBranch() {
    const localBranch = await this._getCurrentBranch();
    const remoteBranch = await this._queryBranch(localBranch.name);
    return compareBranches(localBranch, remoteBranch);
  }

  async fork(newBranchName: string) {
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

  async removeRemoteBranch(branchName: string) {
    if (branchName === 'master') {
      throw new Error('Cannot delete master branch');
    }

    await this._queryRemoveBranch(branchName);
    console.log(`[sync] Deleted remote branch ${branchName}`);
  }

  async removeBranch(branchName: string) {
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

  async checkout(candidates: StatusCandidate[], branchName: string) {
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

    await this._storeHead({
      branch: branchNext.name,
    });
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
    conflicts: MergeConflict[],
    errorMsg: string,
  ): Promise<MergeConflict[]> {
    if (conflicts.length === 0) {
      return conflicts;
    }

    if (!this._conflictHandler) {
      throw new Error(errorMsg);
    }

    return this._conflictHandler(conflicts);
  }

  async allDocuments(): Promise<Record<string, any>> {
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);

    if (!snapshot) {
      throw new Error('Failed to get latest snapshot for all documents');
    }

    return this._getBlobs(snapshot.state.map(s => s.blob));
  }

  async rollbackToLatest(candidates: StatusCandidate[]) {
    const branch = await this._getCurrentBranch();
    const latestSnapshot = await this._getLatestSnapshot(branch.name);

    if (!latestSnapshot) {
      throw new Error('No snapshots to rollback to');
    }

    return this.rollback(latestSnapshot.id, candidates);
  }

  async rollback(snapshotId: string, candidates: StatusCandidate[]) {
    const rollbackSnapshot: Snapshot | null = await this._getSnapshot(snapshotId);

    if (rollbackSnapshot === null) {
      throw new Error(`Failed to find snapshot by id ${snapshotId}`);
    }

    const potentialNewState: SnapshotState = candidates.map(candidate => ({
      key: candidate.key,
      blob: hashDocument(candidate.document).hash,
      name: candidate.name,
    }));

    const delta = stateDelta(potentialNewState, rollbackSnapshot.state);
    // We need to treat removals of candidates differently because they may not yet have been stored as blobs.
    const remove: StatusCandidate[] = [];

    for (const entry of delta.remove) {
      const candidate = candidates.find(candidate => candidate.key === entry.key);

      if (!candidate) {
        // Should never happen
        throw new Error('Failed to find removal in candidates');
      }

      // @ts-expect-error -- TSCONVERSION not sure what this is actually supposed to be
      remove.push(candidate.document);
    }

    console.log(`[sync] Rolled back to ${snapshotId}`);
    const upsert = [...delta.update, ...delta.add];
    return {
      upsert: await this._getBlobs(upsert.map(e => e.blob)),
      remove,
    };
  }

  async getHistoryCount(branchName?: string) {
    const branch = branchName ? await this._getBranch(branchName) : await this._getCurrentBranch();
    return branch?.snapshots.length;
  }

  async getHistory(count = 0) {
    const branch = await this._getCurrentBranch();
    const snapshots: Snapshot[] = [];
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

  async getBranch() {
    const branch = await this._getCurrentBranch();
    return branch.name;
  }

  async getRemoteBranches(): Promise<string[]> {
    const branches = await this._queryBranches();
    return branches.map(b => b.name);
  }

  async getBranches(): Promise<string[]> {
    const branches = await this._getBranches();
    return branches.map(b => b.name);
  }

  async merge(
    candidates: StatusCandidate[],
    otherBranchName: string,
    snapshotMessage?: string,
  ) {
    const branch = await this._getCurrentBranch();
    console.log(`[sync] Merged branch ${otherBranchName} into ${branch.name}`);
    return this._merge(candidates, branch.name, otherBranchName, snapshotMessage);
  }

  async takeSnapshot(stage: Stage, name: string) {
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

      // @ts-expect-error -- TSCONVERSION find out where this is coming from from the Stage union
      if (entry.deleted) {
        continue;
      }

      const { name, blobId: blob } = entry;
      newState.push({
        key,
        name,
        blob,
      });
    }

    const snapshot = await this._createSnapshotFromState(branch, newState, name);
    console.log(`[sync] Created snapshot ${snapshot.id} (${name})`);
  }

  async pull(candidates: StatusCandidate[], teamId: string | undefined | null) {
    await this._getOrCreateRemoteBackendProject(teamId || '');
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

  async shareWithTeam(teamId: string) {
    const { memberKeys, projectKey: backendProjectKey } = await this._queryProjectShareInstructions(teamId);

    const { privateKey } = this._assertSession();

    const symmetricKey = crypt.decryptRSAWithJWK(privateKey, backendProjectKey.encSymmetricKey);
    const keys: any[] = [];

    for (const { accountId, publicKey } of memberKeys) {
      const encSymmetricKey = crypt.encryptRSAWithJWK(JSON.parse(publicKey), symmetricKey);
      keys.push({
        accountId,
        encSymmetricKey,
      });
    }

    await this._queryProjectShare(teamId, keys);
    console.log(`[sync] Shared project ${this._backendProjectId()} with ${teamId}`);
  }

  async unShareWithTeam() {
    await this._queryProjectUnShare();
    console.log(`[sync] Unshared project ${this._backendProjectId()}`);
  }

  async _getOrCreateRemoteBackendProject(teamId: string) {
    const localProject = await this._assertBackendProject();
    let remoteProject = await this._queryProject();

    if (!remoteProject) {
      remoteProject = await this._createRemoteProject(localProject, teamId);
    }

    await this._storeBackendProject(remoteProject);
    return remoteProject;
  }

  async _createRemoteProject({ rootDocumentId, name }: BackendProject, teamId: string) {
    if (!teamId) {
      throw new Error('teamId should be defined');
    }

    const teamKeys = await this._queryTeamMemberKeys(teamId);
    return this._queryCreateProject(rootDocumentId, name, teamId, teamKeys.memberKeys);
  }

  async push(teamId: string | undefined | null) {
    await this._getOrCreateRemoteBackendProject(teamId || '');
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
    const allBlobIds = new Set<string>();
    const snapshots: Snapshot[] = [];

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

  async _fetch(localBranchName: string, remoteBranchName: string) {
    const remoteBranch: Branch | null = await this._queryBranch(remoteBranchName);

    if (!remoteBranch) {
      throw new Error(`The remote branch "${remoteBranchName}" does not exist`);
    }

    // Fetch snapshots and blobs from remote branch
    const snapshotsToFetch: string[] = [];

    for (const snapshotId of remoteBranch.snapshots) {
      const localSnapshot = await this._getSnapshot(snapshotId);

      if (!localSnapshot) {
        snapshotsToFetch.push(snapshotId);
      }
    }

    // Find blobs to fetch
    const blobsToFetch = new Set<string>();
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
    candidates: StatusCandidate[],
    trunkBranchName: string,
    otherBranchName: string,
    snapshotMessage?: string,
    useOtherBranchHistory?: boolean,
  ) {
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
  ) {
    const parentId = branch.snapshots.length
      ? branch.snapshots[branch.snapshots.length - 1]
      : EMPTY_HASH;

    // Create the snapshot
    const id = _generateSnapshotID(parentId, this._backendProjectId(), state);

    const snapshot: Snapshot = {
      id,
      name,
      state,
      author: '',
      // Will be set when pushed
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

  async _runGraphQL(
    query: string,
    variables: Record<string, any>,
    name: string,
  ): Promise<Record<string, any>> {
    const { sessionId } = this._assertSession();

    const { data, errors } = await fetch.post(
      '/graphql?' + name,
      {
        query,
        variables,
      },
      sessionId,
    );

    if (errors && errors.length) {
      console.log(`[sync] Failed to query ${name}`, errors);
      throw new Error(`Failed to query ${name}: ${errors[0].message}`);
    }

    return data;
  }

  async _queryBlobsMissing(ids: string[]): Promise<string[]> {
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
        projectId: this._backendProjectId(),
      },
      'missingBlobs',
    );
    return blobsMissing.missing;
  }

  async _queryBranches(): Promise<Branch[]> {
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
        projectId: this._backendProjectId(),
      },
      'branches',
    );
    // TODO: Fix server returning null instead of empty list
    return branches || [];
  }

  async _queryRemoveBranch(branchName: string) {
    await this._runGraphQL(
      `
      mutation ($projectId: ID!, $branch: String!) {
        branchRemove(project: $projectId, name: $branch)
      }`,
      {
        projectId: this._backendProjectId(),
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
        projectId: this._backendProjectId(),
        branch: branchName,
      },
      'branch',
    );
    return branch;
  }

  async _querySnapshots(allIds: string[]) {
    let allSnapshots: Snapshot[] = [];

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
          projectId: this._backendProjectId(),
        },
        'snapshots',
      );
      allSnapshots = [...allSnapshots, ...snapshots];
    }

    return allSnapshots;
  }

  async _queryPushSnapshots(allSnapshots: Snapshot[]) {
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
          projectId: this._backendProjectId(),
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

  async _queryBlobs(allIds: string[]) {
    const symmetricKey = await this._getBackendProjectSymmetricKey();
    const result: Record<string, Buffer> = {};

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
          projectId: this._backendProjectId(),
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

  async _queryPushBlobs(allIds: string[]) {
    const symmetricKey = await this._getBackendProjectSymmetricKey();

    const next = async (
      items: {
        id: string;
        content: string;
      }[],
    ) => {
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
          projectId: this._backendProjectId(),
        },
        'blobsCreate',
      );
      return blobsCreate.count;
    };

    // Push each missing blob in batches of 2MB max
    let count = 0;
    let batch: { id: string; content: string }[] = [];
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
      batch.push({
        id,
        content: JSON.stringify(encryptedResult, null, 2),
      });
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

  async _queryBackendProjectKey() {
    const { projectKey } = await this._runGraphQL(
      `
        query ($projectId: ID!) {
          projectKey(projectId: $projectId) {
            encSymmetricKey
          }
        }
      `,
      {
        projectId: this._backendProjectId(),
      },
      'projectKey',
    );
    return projectKey.encSymmetricKey as string;
  }

  async _queryTeams() {
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
    return teams as Team[];
  }

  async _queryProjectUnShare() {
    await this._runGraphQL(
      `
        mutation ($id: ID!) {
          projectUnShare(id: $id) {
            id
          }
        }
      `,
      {
        id: this._backendProjectId(),
      },
      'projectUnShare',
    );
  }

  async _queryProjectShare(
    teamId: string,
    keys: {
      accountId: string;
      encSymmetricKey: string;
    }[],
  ) {
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
        id: this._backendProjectId(),
      },
      'projectShare',
    );
  }

  async _queryProjectShareInstructions(
    teamId: string,
  ): Promise<{
    teamId: string;
    projectKey: {
      encSymmetricKey: string;
    };
    memberKeys: {
      accountId: string;
      publicKey: string;
    }[];
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
        id: this._backendProjectId(),
        teamId: teamId,
      },
      'projectShareInstructions',
    );
    return projectShareInstructions;
  }

  async _queryBackendProjects(teamId?: string) {
    const { projects } = await this._runGraphQL(
      `
        query ($teamId: ID) {
          projects(teamId: $teamId) {
            id
            name
            rootDocumentId
            teams {
              id
              name
            }
          }
        }
      `,
      {
        teamId,
      },
      'projects',
    );

    return (projects as BackendProjectWithTeams[]).map(normalizeBackendProjectTeam);
  }

  async _queryProject(): Promise<BackendProject | null> {
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
        id: this._backendProjectId(),
      },
      'project',
    );
    return project;
  }

  async _queryBackendProjectTeams(): Promise<Team[]> {
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
        id: this._backendProjectId(),
      },
      'project.teams',
    );

    if (!project) {
      throw new Error(`Please push the ${strings.collection.singular.toLowerCase()} to be able to share it`);
    }

    return project.teams;
  }

  async _queryTeamMemberKeys(
    teamId: string,
  ): Promise<{
    memberKeys: {
      accountId: string;
      publicKey: string;
    }[];
  }> {
    const { teamMemberKeys } = await this._runGraphQL(
      `
        query ($teamId: ID!) {
          teamMemberKeys(teamId: $teamId) {
            memberKeys {
              accountId
              publicKey
            }
          }
        }
      `,
      {
        teamId: teamId,
      },
      'teamMemberKeys',
    );
    return teamMemberKeys;
  }

  async _queryCreateProject(
    workspaceId: string,
    workspaceName: string,
    teamId: string,
    teamPublicKeys?: {
      accountId: string;
      publicKey: string;
    }[],
  ) {
    // Generate symmetric key for ResourceGroup
    const symmetricKey = await crypt.generateAES256Key();
    const symmetricKeyStr = JSON.stringify(symmetricKey);

    const teamKeys: {accountId: string; encSymmetricKey: string}[] = [];
    let encSymmetricKey: string | undefined;

    if (teamId) {
      if (!teamPublicKeys?.length) {
        throw new Error('teamPublicKeys must not be null or empty!');
      }

      // Encrypt the symmetric key with the public keys of all the team members, ourselves included
      for (const { accountId, publicKey } of teamPublicKeys) {
        teamKeys.push({
          accountId,
          encSymmetricKey: crypt.encryptRSAWithJWK(JSON.parse(publicKey), symmetricKeyStr),
        });
      }
    } else {
      const { publicKey } = this._assertSession();
      // Encrypt the symmetric key with the account public key
      encSymmetricKey = crypt.encryptRSAWithJWK(publicKey, symmetricKeyStr);
    }

    const { projectCreate } = await this._runGraphQL(
      `
        mutation (
          $name: String!,
          $id: ID!,
          $rootDocumentId: ID!,
          $encSymmetricKey: String,
          $teamId: ID,
          $teamKeys: [ProjectCreateKeyInput!],
        ) {
          projectCreate(
            name: $name,
            id: $id,
            rootDocumentId: $rootDocumentId,
            encSymmetricKey: $encSymmetricKey,
            teamId: $teamId,
            teamKeys: $teamKeys,
          ) {
            id
            name
            rootDocumentId
          }
        }
      `,
      {
        name: workspaceName,
        id: this._backendProjectId(),
        rootDocumentId: workspaceId,
        encSymmetricKey: encSymmetricKey,
        teamId: teamId,
        teamKeys: teamKeys,
      },
      'createProject',
    );

    console.log(`[sync] Created remote project ${projectCreate.id} (${projectCreate.name})`);
    return projectCreate as BackendProject;
  }

  async _getBackendProject(): Promise<BackendProject | null> {
    const projectId = this._backendProject ? this._backendProject.id : 'n/a';
    return this._store.getItem(paths.project(projectId));
  }

  async _getBackendProjectById(id: string): Promise<BackendProject | null> {
    return this._store.getItem(paths.project(id));
  }

  async _getBackendProjectSymmetricKey() {
    const { privateKey } = this._assertSession();

    const encSymmetricKey = await this._queryBackendProjectKey();
    const symmetricKeyStr = crypt.decryptRSAWithJWK(privateKey, encSymmetricKey);
    return JSON.parse(symmetricKeyStr);
  }

  async _assertBackendProject() {
    const project = await this._getBackendProject();

    if (project === null) {
      throw new Error('Failed to find local backend project id=' + this._backendProjectId());
    }

    return project;
  }

  async _storeBackendProject(project: BackendProject) {
    return this._store.setItem(paths.project(project.id), project);
  }

  async _getHead(): Promise<Head> {
    const head = await this._store.getItem(paths.head(this._backendProjectId()));

    if (head === null) {
      await this._storeHead({ branch: 'master' });
      return this._getHead();
    }

    return head;
  }

  async _getCurrentBranch() {
    const head = await this._getHead();
    return this._getOrCreateBranch(head.branch);
  }

  _assertSession() {
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

  async _assertBranch(branchName: string) {
    const branch = await this._getBranch(branchName);

    if (branch === null) {
      throw new Error(`Branch does not exist with name ${branchName}`);
    }

    return branch;
  }

  _backendProjectId() {
    if (this._backendProject === null) {
      throw new Error('No active backend project');
    }

    return this._backendProject.id;
  }

  async _getBranch(name: string, backendProjectId?: string): Promise<Branch | null> {
    const pId = backendProjectId || this._backendProjectId();

    const p = paths.branch(pId, name);
    return this._store.getItem(p);
  }

  async _getBranches(backendProjectId?: string) {
    const branches: Branch[] = [];

    const pId = backendProjectId || this._backendProjectId();

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

  async _getBackendProjectByRootDocument(rootDocumentId: string) {
    if (!rootDocumentId) {
      throw new Error('No root document ID supplied for backend project');
    }

    // First, try finding the project
    const backendProjects = await this._allBackendProjects();
    let matchedBackendProjects = backendProjects.filter(p => p.rootDocumentId === rootDocumentId);

    // If there is more than one project for root, try pruning unused ones by branch activity
    if (matchedBackendProjects.length > 1) {
      for (const p of matchedBackendProjects) {
        const branches = await this._getBranches(p.id);

        if (!branches.find(b => b.snapshots.length > 0)) {
          await this._removeProject(p);
          matchedBackendProjects = matchedBackendProjects.filter(({ id }) => id !== p.id);
          console.log(`[sync] Remove inactive project for root ${rootDocumentId}`);
        }
      }
    }

    // If there are still too many, error out
    if (matchedBackendProjects.length > 1) {
      console.log('[sync] Multiple backend projects matched for root', {
        backendProjects,
        matchedBackendProjects,
        rootDocumentId,
      });
      throw new Error('More than one backend project matched query');
    }

    return matchedBackendProjects[0] || null;
  }

  async _getOrCreateBackendProjectByRootDocument(rootDocumentId: string, name: string) {
    let project: BackendProject | null = await this._getBackendProjectByRootDocument(rootDocumentId);

    // If we still don't have a project, create one
    if (!project) {
      const id = generateId('prj');
      project = {
        id,
        name,
        rootDocumentId,
      };
      await this._storeBackendProject(project);
      console.log(`[sync] Created backend project ${project.id}`);
    }

    return project;
  }

  async _allBackendProjects() {
    const backendProjects: BackendProject[] = [];
    const basePath = paths.projects();
    const keys = await this._store.keys(basePath, false);

    for (const key of keys) {
      const id = path.basename(key);
      const p: BackendProject | null = await this._getBackendProjectById(id);

      if (p === null) {
        // Folder exists but project meta file is gone
        continue;
      }

      backendProjects.push(p);
    }

    return backendProjects;
  }

  async _assertSnapshot(id: string) {
    const snapshot: Snapshot = await this._store.getItem(paths.snapshot(this._backendProjectId(), id));

    if (snapshot && typeof snapshot.created === 'string') {
      snapshot.created = new Date(snapshot.created);
    }

    if (!snapshot) {
      throw new Error(`Failed to find snapshot id=${id}`);
    }

    return snapshot;
  }

  async _getSnapshot(id: string) {
    const snapshot: Snapshot = await this._store.getItem(paths.snapshot(this._backendProjectId(), id));

    if (snapshot && typeof snapshot.created === 'string') {
      snapshot.created = new Date(snapshot.created);
    }

    return snapshot;
  }

  async _getLatestSnapshot(branchName: string) {
    const branch = await this._getOrCreateBranch(branchName);
    const snapshots = branch ? branch.snapshots : [];
    const parentId = snapshots.length ? snapshots[snapshots.length - 1] : EMPTY_HASH;
    return this._getSnapshot(parentId);
  }

  async _storeSnapshot(snapshot: Snapshot) {
    return this._store.setItem(paths.snapshot(this._backendProjectId(), snapshot.id), snapshot);
  }

  async _storeSnapshots(snapshots: Snapshot[]) {
    const promises: Promise<Snapshot>[] = [];

    for (const snapshot of snapshots) {
      const p = paths.snapshot(this._backendProjectId(), snapshot.id);
      const promise = this._store.setItem(p, snapshot);
      // @ts-expect-error -- TSCONVERSION appears to be a genuine error
      promises.push(promise);
    }

    await Promise.all(promises);
  }

  async _storeBranch(branch: Branch) {
    const errMsg = VCS.validateBranchName(branch.name);

    if (errMsg) {
      throw new Error(errMsg);
    }

    branch.modified = new Date();
    return this._store.setItem(paths.branch(this._backendProjectId(), branch.name.toLowerCase()), branch);
  }

  async _removeBranch(branch: Branch) {
    return this._store.removeItem(paths.branch(this._backendProjectId(), branch.name));
  }

  async _removeProject(project: BackendProject) {
    console.log(`[sync] Remove local project ${project.id}`);
    return this._store.removeItem(paths.project(project.id));
  }

  async _storeHead(head: Head) {
    await this._store.setItem(paths.head(this._backendProjectId()), head);
  }

  _getBlob(id: string) {
    const p = paths.blob(this._backendProjectId(), id);
    return this._store.getItem(p) as Promise<BaseModel | null>;
  }

  async _getBlobs(ids: string[]) {
    const promises: Promise<Record<string, any> | null>[] = [];

    for (const id of ids) {
      promises.push(this._getBlob(id));
    }

    return Promise.all(promises);
  }

  async _storeBlob(id: string, content: Record<string, any> | null) {
    return this._store.setItem(paths.blob(this._backendProjectId(), id), content);
  }

  async _storeBlobs(map: Record<string, string>) {
    const promises: Promise<any>[] = [];

    for (const id of Object.keys(map)) {
      const buff = Buffer.from(map[id], 'utf8');
      promises.push(this._storeBlob(id, buff));
    }

    await Promise.all(promises);
  }

  async _storeBlobsBuffer(map: Record<string, Buffer>) {
    const promises: Promise<any>[] = [];

    for (const id of Object.keys(map)) {
      const p = paths.blob(this._backendProjectId(), id);
      promises.push(this._store.setItemRaw(p, map[id]));
    }

    await Promise.all(promises);
  }

  async _getBlobRaw(id: string) {
    return this._store.getItemRaw(paths.blob(this._backendProjectId(), id));
  }

  async _hasBlob(id: string) {
    return this._store.hasItem(paths.blob(this._backendProjectId(), id));
  }

  async _queryProjectArchive(projectId: string) {
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

/** Generate snapshot ID from hashing parent, backendProject, and state together */
function _generateSnapshotID(parentId: string, backendProjectId: string, state: SnapshotState) {
  const hash = crypto.createHash('sha1').update(backendProjectId).update(parentId);
  const newState = [...state].sort((a, b) => (a.blob > b.blob ? 1 : -1));

  for (const entry of newState) {
    hash.update(entry.blob);
  }

  return hash.digest('hex');
}
