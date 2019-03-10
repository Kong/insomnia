// @flow
import type {
  DocumentKey,
  Snapshot,
  SnapshotStateMap,
  StatusCandidate,
  StatusCandidateMap,
} from '../types';

export function generateStateMap(snapshot: Snapshot | null): SnapshotStateMap {
  if (snapshot === null) {
    return {};
  }

  const map = {};
  for (const entry of snapshot.state) {
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
