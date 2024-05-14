// @TODOs
// - [ ] Rename things that run a fetch to fetchSomething...
// - [ ] Make sure that pull handles updating the parentId to the current project._id
import clone from 'clone';
import crypto from 'crypto';
import path from 'path';

import * as crypt from '../../account/crypt';
import * as session from '../../account/session';
import { generateId } from '../../common/misc';
import { strings } from '../../common/strings';
import { BaseModel } from '../../models';
import { insomniaFetch } from '../../ui/insomniaFetch';
import Store from '../store';
import type { BaseDriver } from '../store/drivers/base';
import compress from '../store/hooks/compress';
import type {
  BackendWorkspace,
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
import { BackendWorkspaceWithTeams, normalizeBackendWorkspaceTeam } from './normalize-backend-project-team';
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

type ConflictHandler = (conflicts: MergeConflict[], labels: { ours: string; theirs: string }) => Promise<MergeConflict[]>;

// breaks one array into multiple arrays of size chunkSize
export function chunkArray<T>(arr: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let i = 0, j = arr.length; i < j; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

// Stage/Unstage
// Staged items are about to be commited
// Unstaged items have changed compared to staged or not and can be staged
//
export class VCS {
  _store: Store;
  _driver: BaseDriver;
  _backendWorkspace: BackendWorkspace | null;
  _conflictHandler?: ConflictHandler | null;
  _stageByBackendWorkspaceId: Record<string, Stage> = {};

  constructor(driver: BaseDriver, conflictHandler?: ConflictHandler) {
    this._store = new Store(driver, [compress]);
    this._conflictHandler = conflictHandler;
    this._driver = driver;
    // To be set later
    this._backendWorkspace = null;
  }

  newInstance(): VCS {
    const newVCS: VCS = Object.assign({}, this) as any;
    Object.setPrototypeOf(newVCS, VCS.prototype);
    return newVCS;
  }

  async setBackendWorkspace(backendWorkspace: BackendWorkspace) {
    this._backendWorkspace = backendWorkspace;
    console.log(`[sync] Activated project ${backendWorkspace.id}`);
    // Store it because it might not be yet
    await this._storeBackendWorkspace(backendWorkspace);
  }

  hasBackendWorkspace() {
    return this._backendWorkspace !== null;
  }

  async hasBackendWorkspaceForRootDocument(rootDocumentId: string) {
    return Boolean(await this._getBackendWorkspaceByRootDocument(rootDocumentId));
  }

  async removeBackendWorkspacesForRoot(rootDocumentId: string) {
    const all = await this._allBackendWorkspaces();
    const toRemove = all.filter(p => p.rootDocumentId === rootDocumentId);

    for (const backendWorkspace of toRemove) {
      await this._removeProject(backendWorkspace);
    }
  }

  async archiveProject() {
    const backendWorkspaceId = this._backendWorkspaceId();

    await this._queryProjectArchive(backendWorkspaceId);
    await this._store.removeItem(paths.project(backendWorkspaceId));
    this._backendWorkspace = null;
  }

  clearBackendWorkspace() {
    this._backendWorkspace = null;
  }

  async switchProject(rootDocumentId: string) {
    const backendWorkspace = await this._getBackendWorkspaceByRootDocument(rootDocumentId);

    if (backendWorkspace !== null) {
      await this.setBackendWorkspace(backendWorkspace);
    } else {
      this._backendWorkspace = null;
    }
  }

  async switchAndCreateBackendWorkspaceIfNotExist(rootDocumentId: string, name: string) {
    const project = await this._getOrCreateBackendWorkspaceByRootDocument(rootDocumentId, name);
    await this.setBackendWorkspace(project);
  }

  async backendWorkspaceTeams() {
    return this._queryBackendWorkspaceTeams();
  }

  async localBackendWorkspaces() {
    return this._allBackendWorkspaces();
  }

  async remoteBackendWorkspaces({ teamId, teamProjectId }: { teamId: string; teamProjectId: string }) {
    return this._queryBackendWorkspaces(teamId, teamProjectId);
  }

  async remoteBackendWorkspacesInAnyTeam() {
    const { projects } = await this._runGraphQL(
      `
        query ($teamId: ID, $teamProjectId: ID) {
          projects(teamId: $teamId, teamProjectId: $teamProjectId) {
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
        teamId: '',
        teamProjectId: '',
      },
      'projects',
    );

    return (projects as BackendWorkspaceWithTeams[]).map(normalizeBackendWorkspaceTeam);
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

  async status(candidates: StatusCandidate[]) {
    const stage = clone<Stage>(this._stageByBackendWorkspaceId[this._backendWorkspaceId()] || {});
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);
    const state = snapshot ? snapshot.state : [];
    const unstaged: Record<DocumentKey, StageEntry> = {};

    for (const entry of getStagable(state, candidates)) {
      const { key } = entry;
      const stageEntry = stage[key];

      // The entry is not staged
      if (!stageEntry) {
        if ('deleted' in entry) {
          let previousBlobContent: BaseModel | null = null;
          try {
            previousBlobContent = await this.blobFromLastSnapshot(key);

          } catch (e) {
            // No previous blob found
          } finally {
            unstaged[key] = {
              ...entry,
              previousBlobContent: JSON.stringify(previousBlobContent),
            };
          }
        } else {
          const blobId = snapshot ? snapshot.state.find(s => s.key === key)?.blob || '' : '';
          let previousBlobContent: BaseModel | null = null;
          try {
            previousBlobContent = (await this._getBlob(blobId)) || null;
          } catch (e) {
            // No previous blob found
          } finally {
            unstaged[key] = {
              ...entry,
              previousBlobContent: JSON.stringify(previousBlobContent),
            };
          }
        }
      } else if (stageEntry.blobId !== entry.blobId) {
        if ('blobContent' in entry) {
          let previousBlobContent: BaseModel | null = null;
          try {
            previousBlobContent = 'blobContent' in stageEntry ? JSON.parse(stageEntry.blobContent) : {};
          } catch (e) {
            // No previous blob found
          } finally {
            unstaged[key] = {
              ...entry,
              blobId: entry.blobId || stageEntry.blobId,
              previousBlobContent: JSON.stringify(previousBlobContent),
            };
          }
        } else {
          unstaged[key] = entry;
        }
      }
    }

    return {
      stage,
      unstaged,
      key: hash({ stage, unstaged }).hash,
    };
  }

  async stage(stageEntries: StageEntry[]) {
    const stage = clone<Stage>(this._stageByBackendWorkspaceId[this._backendWorkspaceId()] || {});
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
    this._stageByBackendWorkspaceId[this._backendWorkspaceId()] = stage;
    return stage;
  }

  async unstage(stageEntries: StageEntry[]) {
    const stage = clone<Stage>(this._stageByBackendWorkspaceId[this._backendWorkspaceId()] || {});
    for (const entry of stageEntries) {
      delete stage[entry.key];
    }

    console.log(`[sync] Unstaged ${stageEntries.map(e => e.name).join(', ')}`);
    this._stageByBackendWorkspaceId[this._backendWorkspaceId()] = stage;
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
      throw new Error('Please commit current changes before switching branches');
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
    labels: { ours: string; theirs: string },
    errorMsg: string,
  ): Promise<MergeConflict[]> {
    if (conflicts.length === 0) {
      return conflicts;
    }

    if (!this._conflictHandler) {
      throw new Error(errorMsg);
    }

    return this._conflictHandler(conflicts, labels);
  }

  async allDocuments(): Promise<Record<string, any>> {
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);

    if (!snapshot) {
      throw new Error('Failed to get latest commit for all documents');
    }

    return this._getBlobs(snapshot.state.map(s => s.blob));
  }

  async rollbackToLatest(candidates: StatusCandidate[]) {
    const branch = await this._getCurrentBranch();
    const latestSnapshot = await this._getLatestSnapshot(branch.name);

    if (!latestSnapshot) {
      throw new Error('No commits to rollback to');
    }

    return this.rollback(latestSnapshot.id, candidates);
  }

  async rollback(snapshotId: string, candidates: StatusCandidate[]) {
    const rollbackSnapshot: Snapshot | null = await this._getSnapshot(snapshotId);

    if (rollbackSnapshot === null) {
      throw new Error(`Failed to find commit by id ${snapshotId}`);
    }

    const currentState: SnapshotState = candidates.map(candidate => ({
      key: candidate.key,
      blob: hashDocument(candidate.document).hash,
      name: candidate.name,
    }));

    const delta = stateDelta(currentState, rollbackSnapshot.state);
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
    return branch?.snapshots.length || 0;
  }

  async getHistory(count = 0) {
    const branch = await this._getCurrentBranch();
    const snapshots: Snapshot[] = [];
    const total = branch.snapshots.length;
    const slice = count <= 0 || count > total ? 0 : total - count;

    for (const id of branch.snapshots.slice(slice)) {
      const snapshot = await this._getSnapshot(id);

      if (snapshot === null) {
        throw new Error(`Failed to get commit id=${id}`);
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

  async takeSnapshot(name: string) {
    const stage = clone<Stage>(this._stageByBackendWorkspaceId[this._backendWorkspaceId()] || {});

    // Ensure there is something on the stage
    if (Object.keys(stage).length === 0) {
      throw new Error('No changes to commit. Please stage your changes first.');
    }

    const branch: Branch = await this._getCurrentBranch();
    const parent: Snapshot | null = await this._getLatestSnapshot(branch.name);

    if (!name) {
      throw new Error('Commit must have a message');
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

      // @ts-expect-error -- TSCONVERSION find out where this is coming from the Stage union
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

    // Clear the staged changes
    for (const key of Object.keys(stage)) {
      delete stage[key];
    }
    this._stageByBackendWorkspaceId[this._backendWorkspaceId()] = stage;
    console.log(`[sync] Created commit ${snapshot.id} (${name})`);
  }

  async pull({ candidates, teamId, teamProjectId }: { candidates: StatusCandidate[]; teamId: string; teamProjectId: string }) {
    await this._getOrCreateRemoteBackendWorkspace({ teamId, teamProjectId });
    const localBranch = await this._getCurrentBranch();
    const tmpBranchForRemote = await this.customFetch(localBranch.name + '.hidden', localBranch.name);
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

  async _getOrCreateRemoteBackendWorkspace({ teamId, teamProjectId }: { teamId: string; teamProjectId: string }) {
    const localProject = await this._assertBackendWorkspace();
    let remoteProject = await this._queryProject();

    if (!remoteProject) {
      remoteProject = await this._createRemoteProject({ ...localProject, teamId, teamProjectId });
    }

    await this._storeBackendWorkspace(remoteProject);
    return remoteProject;
  }

  async _createRemoteProject({ rootDocumentId, name, teamId, teamProjectId }: BackendWorkspace & { teamId: string; teamProjectId: string }) {
    if (!teamId) {
      throw new Error('teamId should be defined');
    }

    const teamKeys = await this._queryTeamMemberKeys(teamId);
    return this._queryCreateProject(rootDocumentId, name, teamId, teamProjectId, teamKeys.memberKeys);
  }

  async push({ teamId, teamProjectId }: { teamId: string; teamProjectId: string }) {
    await this._getOrCreateRemoteBackendWorkspace({ teamId, teamProjectId });
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

  async customFetch(localBranchName: string, remoteBranchName: string) {
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
      throw new Error('Please commit current changes or revert them before merging');
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
      const conflictsWithContent = await Promise.all(mergeConflicts.map(async conflict => {
        let mineBlobContent: BaseModel | null = null;
        let theirsBlobContent: BaseModel | null = null;
        try {
          mineBlobContent = conflict.mineBlob ? await this._getBlob(conflict.mineBlob) : null;
          theirsBlobContent = conflict.theirsBlob ? await this._getBlob(conflict.theirsBlob) : null;
        } catch (e) {
          // No previous blob found
        }
        return {
          ...conflict,
          mineBlobContent,
          theirsBlobContent,
        };
      }));

      const conflictResolutions = await this.handleAnyConflicts(conflictsWithContent, otherBranchName.includes('.hidden') ? { ours: `${trunkBranchName} local`, theirs: `${otherBranchName.replace('.hidden', '')} remote` } : { ours: trunkBranchName, theirs: otherBranchName }, '');

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
    const id = _generateSnapshotID(parentId, this._backendWorkspaceId(), state);

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
    console.log(`[sync] Created commit '${name}' on ${branch.name}`);
    return snapshot;
  }

  async _runGraphQL(
    query: string,
    variables: Record<string, any>,
    name: string,
  ): Promise<Record<string, any>> {
    const { sessionId } = await this._assertSession();

    const { data, errors } = await insomniaFetch<{ data: {}; errors: [{ message: string }] }>({
      method: 'POST',
      path: '/graphql?' + name,
      data: { query, variables },
      sessionId,
    });

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
        projectId: this._backendWorkspaceId(),
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
        projectId: this._backendWorkspaceId(),
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
        projectId: this._backendWorkspaceId(),
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
        projectId: this._backendWorkspaceId(),
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
          projectId: this._backendWorkspaceId(),
        },
        'snapshots',
      );
      allSnapshots = [...allSnapshots, ...snapshots];
    }

    return allSnapshots;
  }

  async _queryPushSnapshots(allSnapshots: Snapshot[]) {
    const { accountId } = await this._assertSession();

    for (const snapshots of chunkArray(allSnapshots, 20)) {
      // This bit of logic fills in any missing author IDs from times where
      // the user created snapshots while not logged in
      for (const snapshot of snapshots) {
        if (snapshot.author === '') {
          snapshot.author = accountId || '';
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
          projectId: this._backendWorkspaceId(),
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
      console.log('[sync] Pushed commits', snapshotsCreate.map((s: any) => s.id).join(', '));
    }
  }

  async _queryBlobs(allIds: string[]) {
    const symmetricKey = await this._getBackendWorkspaceSymmetricKey();
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
          projectId: this._backendWorkspaceId(),
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
    const symmetricKey = await this._getBackendWorkspaceSymmetricKey();

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
          projectId: this._backendWorkspaceId(),
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

  async _queryBackendWorkspaceKey() {
    const { projectKey } = await this._runGraphQL(
      `
        query ($projectId: ID!) {
          projectKey(projectId: $projectId) {
            encSymmetricKey
          }
        }
      `,
      {
        projectId: this._backendWorkspaceId(),
      },
      'projectKey',
    );
    return projectKey.encSymmetricKey as string;
  }

  async _queryBackendWorkspaces(teamId: string, teamProjectId: string) {
    const { projects } = await this._runGraphQL(
      `
        query ($teamId: ID, $teamProjectId: ID) {
          projects(teamId: $teamId, teamProjectId: $teamProjectId) {
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
        teamProjectId,
      },
      'projects',
    );

    return (projects as BackendWorkspaceWithTeams[]).map(normalizeBackendWorkspaceTeam);
  }

  async _queryProject(): Promise<BackendWorkspace | null> {
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
        id: this._backendWorkspaceId(),
      },
      'project',
    );
    return project;
  }

  async _queryBackendWorkspaceTeams(): Promise<Team[]> {
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
        id: this._backendWorkspaceId(),
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
      autoLinked: boolean;
    }[];
  }> {
    console.log('[sync] Fetching team member keys', {
      teamId,
    });

    const { teamMemberKeys } = await this._runGraphQL(
      `
        query ($teamId: ID!) {
          teamMemberKeys(teamId: $teamId) {
            memberKeys {
              accountId
              publicKey
              autoLinked
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
    teamProjectId: string,
    teamPublicKeys?: {
      accountId: string;
      publicKey: string;
      autoLinked: boolean;
    }[],
  ) {
    // Generate symmetric key for ResourceGroup
    const symmetricKey = await crypt.generateAES256Key();
    const symmetricKeyStr = JSON.stringify(symmetricKey);

    const teamKeys: { accountId: string; encSymmetricKey: string; autoLinked: boolean }[] = [];

    if (!teamId || !teamPublicKeys?.length) {
      throw new Error('teamId and teamPublicKeys must not be null or empty!');
    }

    // Encrypt the symmetric key with the public keys of all the team members, ourselves included
    for (const { accountId, publicKey, autoLinked } of teamPublicKeys) {
      teamKeys.push({
        autoLinked,
        accountId,
        encSymmetricKey: crypt.encryptRSAWithJWK(JSON.parse(publicKey), symmetricKeyStr),
      });
    }

    const { projectCreate } = await this._runGraphQL(
      `
        mutation (
          $name: String!,
          $id: ID!,
          $rootDocumentId: ID!,
          $teamId: ID,
          $teamProjectId: ID,
          $teamKeys: [ProjectCreateKeyInput!],
        ) {
          projectCreate(
            name: $name,
            id: $id,
            rootDocumentId: $rootDocumentId,
            teamId: $teamId,
            teamKeys: $teamKeys,
            teamProjectId: $teamProjectId
          ) {
            id
            name
            rootDocumentId
          }
        }
      `,
      {
        name: workspaceName,
        id: this._backendWorkspaceId(),
        rootDocumentId: workspaceId,
        teamId: teamId,
        teamKeys: teamKeys,
        teamProjectId,
      },
      'createProject',
    );

    console.log(`[sync] Created remote project ${projectCreate.id} (${projectCreate.name})`);
    return projectCreate as BackendWorkspace;
  }

  async _getBackendWorkspace(): Promise<BackendWorkspace | null> {
    const projectId = this._backendWorkspace ? this._backendWorkspace.id : 'n/a';
    return this._store.getItem(paths.project(projectId));
  }

  async _getBackendWorkspaceById(id: string): Promise<BackendWorkspace | null> {
    return this._store.getItem(paths.project(id));
  }

  async _getBackendWorkspaceSymmetricKey() {
    const { privateKey } = await this._assertSession();

    const encSymmetricKey = await this._queryBackendWorkspaceKey();
    const symmetricKeyStr = crypt.decryptRSAWithJWK(privateKey, encSymmetricKey);
    return JSON.parse(symmetricKeyStr);
  }

  async _assertBackendWorkspace() {
    const project = await this._getBackendWorkspace();

    if (project === null) {
      throw new Error('Failed to find local backend project id=' + this._backendWorkspaceId());
    }

    return project;
  }

  async _storeBackendWorkspace(project: BackendWorkspace) {
    return this._store.setItem(paths.project(project.id), project);
  }

  async _getHead(): Promise<Head> {
    const head = await this._store.getItem(paths.head(this._backendWorkspaceId()));

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

  async _assertSession() {
    const { accountId, id, publicKey } = await session.getUserSession();
    const privateKey = await session.getPrivateKey();
    if (!id) {
      throw new Error('Not logged in');
    }

    return {
      accountId,
      sessionId: id,
      privateKey,
      publicKey,
    };
  }

  async _assertBranch(branchName: string) {
    const branch = await this._getBranch(branchName);

    if (branch === null) {
      throw new Error(`Branch does not exist with name ${branchName}`);
    }

    return branch;
  }

  _backendWorkspaceId() {
    if (this._backendWorkspace === null) {
      throw new Error('No active backend project');
    }

    return this._backendWorkspace.id;
  }

  async _getBranch(name: string, backendWorkspaceId?: string): Promise<Branch | null> {
    const pId = backendWorkspaceId || this._backendWorkspaceId();

    const p = paths.branch(pId, name);
    return this._store.getItem(p);
  }

  async _getBranches(backendWorkspaceId?: string) {
    const branches: Branch[] = [];

    const pId = backendWorkspaceId || this._backendWorkspaceId();

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

  async _getBackendWorkspaceByRootDocument(rootDocumentId: string) {
    if (!rootDocumentId) {
      throw new Error('No root document ID supplied for backend project');
    }

    // First, try finding the project
    const backendWorkspaces = await this._allBackendWorkspaces();
    let matchedBackendWorkspaces = backendWorkspaces.filter(p => p.rootDocumentId === rootDocumentId);

    // If there is more than one project for root, try pruning unused ones by branch activity
    if (matchedBackendWorkspaces.length > 1) {
      for (const p of matchedBackendWorkspaces) {
        const branches = await this._getBranches(p.id);

        if (!branches.find(b => b.snapshots.length > 0)) {
          await this._removeProject(p);
          matchedBackendWorkspaces = matchedBackendWorkspaces.filter(({ id }) => id !== p.id);
          console.log(`[sync] Remove inactive project for root ${rootDocumentId}`);
        }
      }
    }

    // If there are still too many, error out
    if (matchedBackendWorkspaces.length > 1) {
      console.log('[sync] Multiple backend projects matched for root', {
        backendWorkspaces,
        matchedBackendWorkspaces,
        rootDocumentId,
      });
      throw new Error('More than one backend project matched query');
    }

    return matchedBackendWorkspaces[0] || null;
  }

  async _getOrCreateBackendWorkspaceByRootDocument(rootDocumentId: string, name: string) {
    let project: BackendWorkspace | null = await this._getBackendWorkspaceByRootDocument(rootDocumentId);

    // If we still don't have a project, create one
    if (!project) {
      const id = generateId('prj');
      project = {
        id,
        name,
        rootDocumentId,
      };
      await this._storeBackendWorkspace(project);
      console.log(`[sync] Created backend project ${project.id}`);
    }

    return project;
  }

  async _allBackendWorkspaces() {
    const backendWorkspaces: BackendWorkspace[] = [];
    const basePath = paths.projects();
    const keys = await this._store.keys(basePath, false);

    for (const key of keys) {
      const id = path.basename(key);
      const p: BackendWorkspace | null = await this._getBackendWorkspaceById(id);

      if (p === null) {
        // Folder exists but project meta file is gone
        continue;
      }

      backendWorkspaces.push(p);
    }

    return backendWorkspaces;
  }

  async _assertSnapshot(id: string) {
    const snapshot: Snapshot = await this._store.getItem(paths.snapshot(this._backendWorkspaceId(), id));

    if (snapshot && typeof snapshot.created === 'string') {
      snapshot.created = new Date(snapshot.created);
    }

    if (!snapshot) {
      throw new Error(`Failed to find commit id=${id}`);
    }

    return snapshot;
  }

  async _getSnapshot(id: string) {
    const snapshot: Snapshot = await this._store.getItem(paths.snapshot(this._backendWorkspaceId(), id));

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
    return this._store.setItem(paths.snapshot(this._backendWorkspaceId(), snapshot.id), snapshot);
  }

  async _storeSnapshots(snapshots: Snapshot[]) {
    const promises: Promise<Snapshot>[] = [];

    for (const snapshot of snapshots) {
      const p = paths.snapshot(this._backendWorkspaceId(), snapshot.id);
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
    return this._store.setItem(paths.branch(this._backendWorkspaceId(), branch.name.toLowerCase()), branch);
  }

  async _removeBranch(branch: Branch) {
    return this._store.removeItem(paths.branch(this._backendWorkspaceId(), branch.name));
  }

  async _removeProject(project: BackendWorkspace) {
    console.log(`[sync] Remove local project ${project.id}`);
    return this._store.removeItem(paths.project(project.id));
  }

  async _storeHead(head: Head) {
    await this._store.setItem(paths.head(this._backendWorkspaceId()), head);
  }

  _getBlob(id: string) {
    const p = paths.blob(this._backendWorkspaceId(), id);
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
    return this._store.setItem(paths.blob(this._backendWorkspaceId(), id), content);
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
      const p = paths.blob(this._backendWorkspaceId(), id);
      promises.push(this._store.setItemRaw(p, map[id]));
    }

    await Promise.all(promises);
  }

  async _getBlobRaw(id: string) {
    return this._store.getItemRaw(paths.blob(this._backendWorkspaceId(), id));
  }

  async _hasBlob(id: string) {
    return this._store.hasItem(paths.blob(this._backendWorkspaceId(), id));
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

/** Generate snapshot ID from hashing parent, backendWorkspace, and state together */
function _generateSnapshotID(parentId: string, backendWorkspaceId: string, state: SnapshotState) {
  const hash = crypto.createHash('sha1').update(backendWorkspaceId).update(parentId);
  const newState = [...state].sort((a, b) => (a.blob > b.blob ? 1 : -1));

  for (const entry of newState) {
    hash.update(entry.blob);
  }

  return hash.digest('hex');
}
