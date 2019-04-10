// @flow

import type { BaseDriver } from '../store/drivers/base';
import Store from '../store';
import crypto from 'crypto';
import compress from '../store/hooks/compress';
import * as paths from './paths';
import { jsonHash } from '../lib/jsonHash';
import { crypt, fetch, session } from 'insomnia-account';
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
  Team,
} from '../types';
import {
  compareBranches,
  generateCandidateMap,
  getRootSnapshot,
  getStagable,
  preMergeCheck,
  stateDelta,
  threeWayMerge,
} from './util';
import { generateId } from '../../common/misc';

const EMPTY_HASH = crypto
  .createHash('sha1')
  .digest('hex')
  .replace(/./g, '0');

type SessionData = {|
  accountId: string,
  sessionId: string,
  privateKey: Object,
  publicKey: Object,
|};

export default class VCS {
  _store: Store;
  _driver: BaseDriver;
  _project: Project | null;

  constructor(driver: BaseDriver) {
    this._store = new Store(driver, [compress]);
    this._driver = driver;

    // To be set later
    this._project = null;
  }

  newInstance(): VCS {
    const newVCS: VCS = (Object.assign({}, this): any);
    Object.setPrototypeOf(newVCS, VCS.prototype);
    return newVCS;
  }

  async currentProject(): Promise<Project> {
    return this._assertProject();
  }

  unsetProject(): void {
    this._project = null;
  }

  async switchProject(rootDocumentId: string, name: string): Promise<Project> {
    const project = await this._getOrCreateProject(rootDocumentId, name);
    this._project = project;

    console.log(`[sync] Activate project ${project.id}`);

    return project;
  }

  async teams(): Promise<Array<Team>> {
    return this._queryTeams();
  }

  async projectTeams(): Promise<Array<Team>> {
    return this._queryProjectTeams();
  }

  async remoteProjects(): Promise<Array<Project>> {
    return this._queryProjects();
  }

  async status(candidates: Array<StatusCandidate>, stage: Stage): Promise<Status> {
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
      key: jsonHash({ stage, unstaged }).hash,
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

    return stage;
  }

  async unstage(stage: Stage, stageEntries: Array<StageEntry>): Promise<Stage> {
    for (const entry of stageEntries) {
      delete stage[entry.key];
    }

    return stage;
  }

  static validateBranchName(branchName: string): string {
    if (!branchName.match(/^[a-zA-Z0-9][a-zA-Z0-9-_.]{3,}$/)) {
      return 'Branch names can only contain letters, numbers, - and _';
    }

    return '';
  }

  async compareRemoteBranch(): Promise<{ ahead: number, behind: number }> {
    const localBranch = await this._getCurrentBranch();
    const remoteBranch = await this._queryBranch(localBranch.name);
    return compareBranches(localBranch, remoteBranch);
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
    const upsert = [...add, ...update];

    // Remove all dirty items from the delta so we keep them around
    return {
      upsert: await this._getBlobs(upsert.map(e => e.blob)),
      remove: await this._getBlobs(remove.map(e => e.blob)),
    };
  }

  async allDocuments(): Promise<Object> {
    const branch = await this._getCurrentBranch();
    const snapshot: Snapshot | null = await this._getLatestSnapshot(branch.name);
    if (!snapshot) {
      throw new Error('Failed to get latest snapshot for all documents');
    }

    return this._getBlobs(snapshot.state.map(s => s.blob));
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
      blob: jsonHash(c.document).hash,
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

    const upsert = [...delta.update, ...delta.add];
    return {
      upsert: await this._getBlobs(upsert.map(e => e.blob)),
      remove,
    };
  }

  async getHistoryCount(): Promise<number> {
    const branch = await this._getCurrentBranch();
    return branch.snapshots.length;
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
    for (const p of await this._store.keys(paths.branches(this._projectId()))) {
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
    snapshotMessage?: string,
  ): Promise<{
    upsert: Array<Object>,
    remove: Array<Object>,
  }> {
    const branch = await this._getCurrentBranch();
    return this._merge(candidates, branch.name, otherBranchName, snapshotMessage);
  }

  async takeSnapshot(stage: Stage, name: string): Promise<void> {
    const branch: Branch = await this._getCurrentBranch();
    const parent: Snapshot | null = await this._getLatestSnapshot(branch.name);

    // Ensure there is something on the stage
    if (Object.keys(stage).length === 0) {
      throw new Error('Snapshot does not have any changes');
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

  async pull(
    candidates: Array<StatusCandidate>,
  ): Promise<{
    upsert: Array<Object>,
    remove: Array<Object>,
  }> {
    await this._getOrCreateRemoteProject();

    const localBranch = await this._getCurrentBranch();
    const tmpBranch = await this._fetch(localBranch.name + '.hidden', localBranch.name);

    // NOTE: Unlike Git, we merge into the tmp branch and overwrite the local one. This is
    //   so the remote history is preserved when after the pull. In particular, this is
    //   important if a remote and local branch both exist but do not share a common history.
    const message = `Synced latest changes from ${localBranch.name}`;
    const delta = await this._merge(candidates, tmpBranch.name, localBranch.name, message);

    const tmpBranchUpdated = await this._getBranch(tmpBranch.name);
    if (!tmpBranchUpdated) {
      // Should never happen
      throw new Error(`Failed to get temporary branch ${tmpBranch.name}`);
    }

    const branch: Branch = Object.assign(({}: any), tmpBranchUpdated, {
      name: localBranch.name,
    });

    await this._storeBranch(branch);
    await this._removeBranch(tmpBranch);

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
  }

  async unShareWithTeam(): Promise<void> {
    await this._queryProjectUnShare();
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
      const missingIds = await this._queryBlobsMissing(snapshot.state);
      await this._queryPushBlobs(missingIds);

      await this._queryPushSnapshot(snapshot);
    }
  }

  async _fetch(localBranchName: string, remoteBranchName: string): Promise<Branch> {
    const remoteBranch: Branch | null = await this._queryBranch(remoteBranchName);
    if (!remoteBranch) {
      throw new Error(`The remote branch "${remoteBranchName}" does not exist`);
    }

    // Fetch snapshots and blobs from remote branch
    let blobsToFetch = new Set();
    for (const snapshotId of remoteBranch.snapshots) {
      const localSnapshot = await this._getSnapshot(snapshotId);

      // We already have the snapshot, so skip it
      if (localSnapshot) {
        continue;
      }

      const snapshot = await this._querySnapshot(snapshotId);
      for (let i = 0; i < snapshot.state.length; i++) {
        const entry = snapshot.state[i];

        const hasBlob = await this._hasBlob(entry.blob);
        if (!hasBlob) {
          blobsToFetch.add(entry.blob);
        }

        if (blobsToFetch.size > 10 || i === snapshot.state.length - 1) {
          const ids = Array.from(blobsToFetch);
          const blobs = await this._queryBlobs(ids);
          await this._storeBlobsBuffer(blobs);
          blobsToFetch.clear();
        }
      }

      // Store the snapshot
      await this._storeSnapshot(snapshot);
    }

    const branchDefaults = {
      name: '',
      created: new Date(),
      modified: new Date(),
      snapshots: [],
    };

    const branch: Branch = Object.assign(branchDefaults, remoteBranch, {
      name: localBranchName,
    });

    await this._storeBranch(branch);

    return branch;
  }

  async _merge(
    candidates: Array<StatusCandidate>,
    trunkBranchName: string,
    otherBranchName: string,
    snapshotMessage?: string,
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

    // Other branch has a history that is a prefix of the current one
    if (latestSnapshotOther && latestSnapshotOther.id === rootSnapshotId) {
      console.log('[sync] Nothing to merge');
    } else if (
      rootSnapshot &&
      (!latestSnapshotTrunk || rootSnapshot.id === latestSnapshotTrunk.id)
    ) {
      console.log('[sync] Performing fast-forward merge');
      branchTrunk.snapshots = branchOther.snapshots;
      await this._storeBranch(branchTrunk);
    } else {
      const rootState = rootSnapshot ? rootSnapshot.state : [];

      if (preConflicts.length) {
        console.log('[sync] Merge failed', preConflicts);
        throw new Error(
          'Cannot merge with current changes. Please create a snapshot before merging',
        );
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

      const name = snapshotMessage || `Merged branch ${branchOther.name}`;
      await this._createSnapshotFromState(branchTrunk, latestSnapshotTrunk, state, name);
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
    parent: Snapshot | null,
    state: SnapshotState,
    name: string,
  ): Promise<Snapshot> {
    const parentId: string = parent ? parent.id : EMPTY_HASH;

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

    return snapshot;
  }

  async _runGraphQL(query: string, variables: { [string]: any }, name: string): Promise<Object> {
    const { sessionId } = this._assertSession();
    const { data, errors } = await fetch.post('/graphql?' + name, { query, variables }, sessionId);

    if (errors && errors.length) {
      throw new Error(`Failed to query ${name}`);
    }

    return data;
  }

  async _queryBlobsMissing(state: SnapshotState): Promise<Array<string>> {
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
          projectId: this._projectId(),
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

  async _querySnapshot(id: string): Promise<Snapshot> {
    const { snapshot } = await this._runGraphQL(
      `
      query ($id: ID!, $projectId: ID!) {
        snapshot(id: $id, project: $projectId) {
          id
          parent
          created
          author
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
        id,
        projectId: this._projectId(),
      },
      'project',
    );

    return snapshot;
  }

  async _queryPushSnapshot(snapshot: Snapshot): Promise<void> {
    const { accountId } = this._assertSession();

    // This bit of logic fills in any missing author IDs from times where
    // the user created snapshots while not logged in
    if (snapshot.author === '') {
      snapshot.author = accountId;
    }

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
        projectId: this._projectId(),
        snapshot,
      },
      'snapshotPush',
    );

    console.log('[sync] Pushed snapshot', snapshotCreate.id);
  }

  async _queryBlobs(ids: Array<string>): Promise<{ [string]: Buffer }> {
    const symmetricKey = await this._getProjectSymmetricKey();
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

    const result = {};
    for (const blob of blobs) {
      const encryptedResult = JSON.parse(blob.content);
      result[blob.id] = crypt.decryptAESToBuffer(symmetricKey, encryptedResult);
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
      if (batchSizeBytes > maxBatchSize || isLastId) {
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
    const run = async () => {
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
      return project;
    };

    let project = await run();

    // Retry once if project doesn't exist yet
    if (project === null) {
      await this._getOrCreateRemoteProject();
      project = await run();
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
      'createProject',
    );

    return projectCreate;
  }

  async _getProject(): Promise<Project | null> {
    return this._store.getItem(paths.project(this._projectId()));
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
      throw new Error('Failed to get project id=' + this._projectId());
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

  _assertSession(): SessionData {
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

  async _getBranch(name: string): Promise<Branch | null> {
    const p = paths.branch(this._projectId(), name);
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

  async _getOrCreateProject(rootDocumentId: string, name: string): Promise<Project> {
    if (!rootDocumentId) {
      throw new Error('No root document ID supplied for project');
    }

    if (!name) {
      throw new Error('No name supplied for project');
    }

    // First, try finding the project
    const projects = await this._allProjects();
    const matchedProjects = projects.filter(p => p.rootDocumentId === rootDocumentId);
    if (matchedProjects.length > 1) {
      // TODO: Handle this case
      throw new Error('More than one project matched query');
    }

    let project: Project | null = matchedProjects[0];

    if (!project) {
      const id = generateId('prj');
      project = { id, name, rootDocumentId };
    }

    await this._storeProject(project);

    return project;
  }

  async _allProjects(): Promise<Array<Project>> {
    const projects = [];
    const keys = await this._store.keys(paths.projects());
    for (const key of keys) {
      const p: Project | null = await this._store.getItem(key);
      if (p === null) {
        // Should never happen
        throw new Error(`Failed to get project path=${key}`);
      }

      projects.push(p);
    }

    return projects;
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

  async _storeHead(head: Head): Promise<void> {
    await this._store.setItem(paths.head(this._projectId()), head);
  }

  async _getBlobs(ids: Array<string>): Promise<Array<Object>> {
    const promises = [];
    for (const id of ids) {
      const p = paths.blob(this._projectId(), id);
      promises.push(this._store.getItem(p));
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

  return hash.digest('hex').substring(0, 15);
}
