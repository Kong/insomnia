import clone from 'clone';
import crypto from 'crypto';

import { strings } from '../../common/strings';
import { BaseModel } from '../../models';
import { deleteKeys, resetKeys, shouldIgnoreKey } from '../ignore-keys';
import { deterministicStringify } from '../lib/deterministicStringify';
import type {
  Branch,
  DocumentKey,
  MergeConflict,
  Snapshot,
  SnapshotState,
  SnapshotStateEntry,
  SnapshotStateMap,
  StageEntry,
  StatusCandidate,
  StatusCandidateMap,
} from '../types';

export function generateSnapshotStateMap(snapshot: Snapshot | null): SnapshotStateMap {
  if (!snapshot) {
    return {};
  }

  return generateStateMap(snapshot.state);
}

export function generateStateMap(state: SnapshotState | null): SnapshotStateMap {
  if (!state) {
    return {};
  }

  const map = {};

  for (const entry of state) {
    map[entry.key] = entry;
  }

  return map;
}

export function generateCandidateMap(candidates: StatusCandidate[]): StatusCandidateMap {
  const map = {};

  for (const candidate of candidates) {
    map[candidate.key] = candidate;
  }

  return map;
}

export function combinedMapKeys<T extends SnapshotStateMap | StatusCandidateMap>(
  ...maps: T[]
): DocumentKey[] {
  const keyMap = {};

  for (const map of maps) {
    for (const key of Object.keys(map)) {
      keyMap[key] = true;
    }
  }

  return Object.keys(keyMap);
}

export function threeWayMerge(
  root: SnapshotState,
  trunk: SnapshotState,
  other: SnapshotState,
): {
  state: SnapshotState;
  conflicts: MergeConflict[];
} {
  const stateRoot = generateStateMap(root);
  const stateTrunk = generateStateMap(trunk);
  const stateOther = generateStateMap(other);
  const allKeys = combinedMapKeys(stateRoot, stateTrunk, stateOther);
  const newState: SnapshotState = [];
  const conflicts: MergeConflict[] = [];

  for (const key of allKeys) {
    const root = stateRoot[key] || null;
    const trunk = stateTrunk[key] || null;
    const other = stateOther[key] || null;

    // This condition tree checks every possible case that root, trunk, other can be in
    // separately. YES, it could be simplified but we want to expand every case to make
    // it as bulletproof and readable as possible.
    //
    // Here are the possible combinations:
    //   root  => [ exists, missing ]
    //   trunk => [ exists, missing, modified ]
    //   other => [ exists, missing, modified ]
    //
    // Therefore, the total number of cases is equal to 2 * 3! = 12
    // ~~~~~~~~~~ //
    // Unmodified //
    // ~~~~~~~~~~ //
    // (1/12)
    // Unmodified
    if (root && trunk && other && root.blob === trunk.blob && root.blob === other.blob) {
      newState.push(trunk);
      continue;
    }

    // ~~~~~~~~~ //
    // Deletions //
    // ~~~~~~~~~ //
    // (2/12)
    // Deleted in both
    if (root && trunk === null && other === null) {
      continue;
    }

    // (3/12)
    // Deleted in trunk
    if (root && trunk === null && other && other.blob === root.blob) {
      continue;
    }

    // (4/12)
    // Deleted in other
    if (root && trunk && other === null && trunk.blob === root.blob) {
      continue;
    }

    // ~~~~~~~~~ //
    // Additions //
    // ~~~~~~~~~ //
    // (5/12)
    // Added in both
    if (root === null && trunk && other) {
      if (trunk.blob !== other.blob) {
        conflicts.push({
          key,
          name: other.name,
          message: 'both added',
          mineBlob: trunk.blob,
          theirsBlob: other.blob,
          choose: other.blob,
        });
      }

      newState.push(trunk || other);
      continue;
    }

    // (6/12)
    // Added in trunk
    if (root === null && trunk && other === null) {
      newState.push(trunk);
      continue;
    }

    // (7/12)
    // Added in other
    if (root === null && trunk === null && other) {
      newState.push(other);
      continue;
    }

    // ~~~~~~~~~~~~~ //
    // Modifications //
    // ~~~~~~~~~~~~~ //
    // (8/12)
    // Modified in both
    if (root && trunk && other && root.blob !== trunk.blob && root.blob !== other.blob) {
      if (trunk.blob !== other.blob) {
        conflicts.push({
          key,
          name: other.name,
          message: 'both modified',
          mineBlob: trunk.blob,
          theirsBlob: other.blob,
          choose: other.blob,
        });
      }

      newState.push(trunk);
      continue;
    }

    // (9/12)
    // Modified in trunk
    if (root && trunk && other && root.blob !== trunk.blob && root.blob === other.blob) {
      newState.push(trunk);
      continue;
    }

    // (10/12)
    // Modified in other
    if (root && trunk && other && root.blob === trunk.blob && root.blob !== other.blob) {
      newState.push(other);
      continue;
    }

    // ~~~~~~ //
    // Combos //
    // ~~~~~~ //
    // (11/12)
    // Deleted in trunk and modified in other
    if (root && trunk === null && other && other.blob !== root.blob) {
      conflicts.push({
        key,
        name: other.name,
        message: 'you deleted and they modified',
        mineBlob: null,
        theirsBlob: other.blob,
        choose: other.blob,
      });
      newState.push(other);
      continue;
    }

    // (12/12)
    // Deleted in other and modified in trunk
    if (root && trunk && other === null && trunk.blob !== root.blob) {
      conflicts.push({
        key,
        name: root.name,
        message: 'they deleted and you modified',
        mineBlob: trunk.blob,
        theirsBlob: null,
        choose: trunk.blob,
      });
      newState.push(trunk);
      continue;
    }

    // This should never actually happen, but let's error just to be safe
    throw new Error('3-way merge hit impossible state');
  }

  return {
    state: newState,
    conflicts: conflicts,
  };
}

export function compareBranches(
  a: Branch | null,
  b: Branch | null,
): {
  ahead: number;
  behind: number;
} {
  const snapshotsA = a ? a.snapshots : [];
  const snapshotsB = b ? b.snapshots : [];
  const latestA = snapshotsA[snapshotsA.length - 1] || null;
  const latestB = snapshotsB[snapshotsB.length - 1] || null;
  const result = {
    ahead: 0,
    behind: 0,
  };

  if (latestA === latestB) {
    return result;
  }

  if (latestA === null) {
    result.behind = snapshotsB.length;
    return result;
  }

  if (latestB === null) {
    result.ahead = snapshotsA.length;
    return result;
  }

  const root = getRootSnapshot(a, b);

  if (root === null) {
    return result;
  }

  const indexOfRootInA = snapshotsA.indexOf(root);
  const indexOfRootInB = snapshotsB.indexOf(root);
  result.ahead = snapshotsA.length - indexOfRootInA - 1;
  result.behind = snapshotsB.length - indexOfRootInB - 1;
  return result;
}

export interface StateDelta {
  add: SnapshotStateEntry[];
  update: SnapshotStateEntry[];
  remove: SnapshotStateEntry[];
}

export function stateDelta(
  base: SnapshotState,
  desired: SnapshotState,
) {
  const result: StateDelta = {
    add: [],
    update: [],
    remove: [],
  };
  const stateMapStart = generateStateMap(base);
  const stateMapFinish = generateStateMap(desired);

  for (const key of combinedMapKeys(stateMapStart, stateMapFinish)) {
    const start = stateMapStart[key];
    const finish = stateMapFinish[key];

    if (!start && finish) {
      result.add.push(finish);
      continue;
    }

    if (start && !finish) {
      result.remove.push(start);
      continue;
    }

    if (start && finish && start.blob !== finish.blob) {
      result.update.push(finish);
      continue;
    }
  }

  return result;
}

export function getStagable(state: SnapshotState, candidates: StatusCandidate[]) {
  const stagable: StageEntry[] = [];
  const stateMap = generateStateMap(state);
  const candidateMap = generateCandidateMap(candidates);

  // @ts-expect-error -- TSCONVERSION need to fix the index signatures
  for (const key of combinedMapKeys(stateMap, candidateMap)) {
    const entry = stateMap[key];
    const candidate = candidateMap[key];

    if (!entry && candidate) {
      const { name, document } = candidate;
      const { hash: blobId, content: blobContent } = hashDocument(document);
      stagable.push({
        key,
        name,
        blobId,
        blobContent,
        added: true,
      });
      continue;
    }

    if (entry && !candidate) {
      const { name, blob: blobId } = entry;
      stagable.push({
        key,
        name,
        blobId,
        deleted: true,
      });
      continue;
    }

    if (entry && candidate) {
      const { document, name } = candidate;
      const { hash: blobId, content: blobContent } = hashDocument(document);

      if (entry.blob !== blobId) {
        stagable.push({
          key,
          name,
          blobId,
          blobContent,
          modified: true,
        });
      }

      continue;
    }
  }

  return stagable;
}

export function getRootSnapshot(a: Branch | null, b: Branch | null): string | null {
  const snapshotsA = a ? a.snapshots : [];
  const snapshotsB = b ? b.snapshots : [];
  const rootSnapshotId = '';

  for (let ai = snapshotsA.length - 1; ai >= 0; ai--) {
    for (let bi = snapshotsB.length - 1; bi >= 0; bi--) {
      if (snapshotsA[ai] === snapshotsB[bi]) {
        return snapshotsA[ai];
      }
    }
  }

  return rootSnapshotId || null;
}

export function preMergeCheck(
  trunkState: SnapshotState,
  otherState: SnapshotState,
  candidates: StatusCandidate[],
) {
  const conflicts: StatusCandidate[] = [];
  const dirty: StatusCandidate[] = [];
  const trunkMap = generateStateMap(trunkState);
  const otherMap = generateStateMap(otherState);

  for (const candidate of candidates) {
    const { key } = candidate;
    const trunk = trunkMap[key];
    const other = otherMap[key];

    // Candidate is not in trunk or other (not yet in version control)
    if (!trunk && !other) {
      dirty.push(candidate);
      continue;
    }

    const { hash: blobId } = hashDocument(candidate.document);

    // Candidate is same as trunk (unchanged) so anything goes
    if (trunk && trunk.blob === blobId) {
      continue;
    }

    // Candidate is the same as trunk (nothing to do)
    if (trunk && blobId === trunk.blob) {
      continue;
    }

    // Candidate is the same as other (would update to same value)
    if (other && blobId === other.blob) {
      continue;
    }

    // Candidate is different but trunk and other are the same (preserve safe change)
    if (
      other &&
      trunk &&
      other.blob === trunk.blob &&
      blobId !== other.blob &&
      blobId !== trunk.blob
    ) {
      dirty.push(candidate);
      continue;
    }

    // All other cases result in conflict
    conflicts.push(candidate);
  }

  return {
    conflicts,
    dirty,
  };
}

// Intentionally any to handle strange types, see unit tests
export function hash(obj?: any): {
  content: string;
  hash: string;
} {
  if (!obj) {
    throw new Error('Cannot hash undefined value');
  }

  const content = deterministicStringify(obj);
  const hash = crypto.createHash('sha1').update(content).digest('hex');
  return {
    hash,
    content,
  };
}

export function hashDocument(doc?: BaseModel) {
  // Remove fields we don't care about for sync purposes
  const newDoc = clone(doc);

  if (newDoc) {
    deleteKeys(newDoc);
    resetKeys(newDoc);
  }

  return hash(newDoc);
}

export function updateStateWithConflictResolutions(state: SnapshotState, conflicts: MergeConflict[]) {
  const newStateMap = generateStateMap(state);

  for (const { choose, key, name } of conflicts) {
    const stateEntry = state.find(e => e.key === key);

    // Not in the state, but we choose the conflict
    if (!stateEntry && choose !== null) {
      newStateMap[key] = {
        key,
        name,
        blob: choose,
      };
      continue;
    }

    // Add the conflict
    if (choose !== null) {
      // @ts-expect-error -- TSCONVERSION need to decided how to reorder this
      newStateMap[key] = {
        ...stateEntry,
        blob: choose,
      };
      continue;
    }

    // Chose to delete it, so don't add to state
    delete newStateMap[key];
  }

  return Object.keys(newStateMap).map(k => newStateMap[k]);
}

export function describeChanges<T extends BaseModel>(a: T, b: T): string[] {
  const aT = Object.prototype.toString.call(a);
  const bT = Object.prototype.toString.call(b);

  if (aT !== '[object Object]' || bT !== '[object Object]') {
    return [];
  }

  const changes: string[] = [];
  const allKeys = [...Object.keys({ ...a, ...b })];

  for (const key of allKeys) {
    if (shouldIgnoreKey(key as keyof T, a)) {
      continue;
    }

    const aValue = a[key];
    const bValue = b[key];
    const aStr = deterministicStringify(aValue);
    const bStr = deterministicStringify(bValue);

    if (aValue === undefined && bValue !== undefined) {
      changes.push(`+${key}`);
      continue;
    }

    if (aValue !== undefined && bValue === undefined) {
      changes.push(`-${key}`);
      continue;
    }

    if (aStr !== bStr) {
      changes.push(key);
    }
  }

  return changes;
}

export const interceptAccessError = async <T>(
  {
    callback,
    action,
    resourceName,
    resourceType = strings.collection.singular.toLowerCase(),
  }: {
    callback: () => T | Promise<T>;
    action: string;
    resourceName: string;
    resourceType?: string;
  }
) => {
  try {
    return await callback();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('invalid access')) {
      throw new Error(`You no longer have permission to ${action} the "${resourceName}" ${resourceType}.  Contact your team administrator if you think this is an error.`);
    }
    throw error;
  }
};
