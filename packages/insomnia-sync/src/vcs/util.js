// @flow
import type {
  Branch,
  DocumentKey,
  Snapshot,
  SnapshotState,
  SnapshotStateEntry,
  SnapshotStateMap,
  StageEntry,
  StatusCandidate,
  StatusCandidateMap,
} from '../types';
import { jsonHash } from '../lib/jsonHash';

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

export function generateCandidateMap(candidates: Array<StatusCandidate>): StatusCandidateMap {
  const map = {};
  for (const candidate of candidates) {
    map[candidate.key] = candidate;
  }
  return map;
}

export function combinedMapKeys<T: SnapshotStateMap | StatusCandidateMap>(
  ...maps: Array<T>
): Array<DocumentKey> {
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
): { state: SnapshotState, conflicts: Array<DocumentKey> } {
  const stateRoot = generateStateMap(root);
  const stateTrunk = generateStateMap(trunk);
  const stateOther = generateStateMap(other);
  const allKeys = combinedMapKeys(stateRoot, stateTrunk, stateOther);

  const newState: SnapshotState = [];
  const conflicts: Array<DocumentKey> = [];

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
        conflicts.push(key);
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
        conflicts.push(key);
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
      conflicts.push(key);
      newState.push(other);
      continue;
    }

    // (12/12)
    // Deleted in other and modified in other
    if (root && trunk && other === null && trunk.blob !== root.blob) {
      conflicts.push(key);
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

export function stateDelta(
  base: SnapshotState,
  desired: SnapshotState,
): {
  add: Array<SnapshotStateEntry>,
  update: Array<SnapshotStateEntry>,
  remove: Array<SnapshotStateEntry>,
} {
  const result = {
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

export function getStagable(
  state: SnapshotState,
  candidates: Array<StatusCandidate>,
): Array<StageEntry> {
  const stagable: Array<StageEntry> = [];

  const stateMap = generateStateMap(state);
  const candidateMap = generateCandidateMap(candidates);
  for (const key of combinedMapKeys(stateMap, candidateMap)) {
    const entry = stateMap[key];
    const candidate = candidateMap[key];

    if (!entry && candidate) {
      const { name, document } = candidate;
      const { hash: blobId, content: blobContent } = jsonHash(document);
      stagable.push({ key, name, blobId, blobContent, added: true });
      continue;
    }

    if (entry && !candidate) {
      const { name, blob: blobId } = entry;
      stagable.push({ key, name, blobId, deleted: true });
      continue;
    }

    if (entry && candidate) {
      const { document, name } = candidate;
      const { hash: blobId, content: blobContent } = jsonHash(document);
      if (entry.blob !== blobId) {
        stagable.push({ key, name, blobId, blobContent, modified: true });
      }
      continue;
    }
  }

  return stagable;
}

export function getRootSnapshot(a: Branch, b: Branch): string | null {
  let rootSnapshotId = '';
  for (let ai = a.snapshots.length - 1; ai >= 0; ai--) {
    for (let bi = b.snapshots.length - 1; bi >= 0; bi--) {
      if (a.snapshots[ai] === b.snapshots[bi]) {
        return a.snapshots[ai];
      }
    }
  }
  return rootSnapshotId || null;
}

export function preMergeCheck(
  trunkState: SnapshotState,
  otherState: SnapshotState,
  candidates: Array<StatusCandidate>,
): {
  conflicts: Array<StatusCandidate>,
  dirty: Array<StatusCandidate>,
} {
  const result = {
    conflicts: [],
    dirty: [],
  };

  const trunkMap = generateStateMap(trunkState);
  const otherMap = generateStateMap(otherState);

  for (const candidate of candidates) {
    const { key } = candidate;
    const trunk = trunkMap[key];
    const other = otherMap[key];

    // Candidate is not in trunk or other (not yet in version control)
    if (!trunk && !other) {
      result.dirty.push(candidate);
      continue;
    }

    const { hash: blobId } = jsonHash(candidate.document);

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
      result.dirty.push(candidate);
      continue;
    }

    // All other cases result in conflict
    result.conflicts.push(candidate);
  }

  return result;
}
