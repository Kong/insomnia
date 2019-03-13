import {
  combinedMapKeys,
  generateCandidateMap,
  generateSnapshotStateMap,
  threeWayMerge,
} from '../snapshots';

describe('snapshots', () => {
  describe('generateSnapshotStateMap()', () => {
    it('generates from simple states', async () => {
      const snapshot = newSnapshot(1, [
        newStateEntry('doc_1', 'blob_1'),
        newStateEntry('doc_2', 'blob_2'),
      ]);

      const map = generateSnapshotStateMap(snapshot);
      expect(Object.keys(map).sort()).toEqual(['doc_1', 'doc_2']);
    });

    it('works with duplicates', async () => {
      const snapshot = newSnapshot(1, [
        newStateEntry('doc_1', 'blob_1'),
        newStateEntry('doc_2', 'blob_2'),
        newStateEntry('doc_2', 'blob_2'),
        newStateEntry('doc_2', 'blob_2'),
      ]);

      const map = generateSnapshotStateMap(snapshot);
      expect(Object.keys(map).sort()).toEqual(['doc_1', 'doc_2']);
    });

    it('works with null snapshots', async () => {
      const map = generateSnapshotStateMap(null);
      expect(map).toEqual({});
    });
  });

  describe('generateCandidateMap()', () => {
    it('generates from simple candidates', async () => {
      const candidates = [
        newCandidate('doc_2', 2),
        newCandidate('doc_1', 1),
        newCandidate('doc_2', 2),
      ];

      const map = generateCandidateMap(candidates);
      expect(Object.keys(map).sort()).toEqual(['doc_1', 'doc_2']);
    });
  });

  describe('combineMapKeys()', () => {
    it('generates from simple states', async () => {
      const map1 = generateSnapshotStateMap(
        newSnapshot(1, [newStateEntry('doc_1', 'blob_1'), newStateEntry('doc_2', 'blob_2')]),
      );
      const map2 = generateSnapshotStateMap(
        newSnapshot(1, [newStateEntry('doc_4', 'blob_4'), newStateEntry('doc_1', 'blob_1')]),
      );
      const map3 = generateSnapshotStateMap(newSnapshot(1, []));

      const keys = combinedMapKeys(map1, map2, map3);
      expect(keys.sort()).toEqual(['doc_1', 'doc_2', 'doc_4']);
    });
  });

  describe('threeWayMerge()', () => {
    const A1 = { key: 'a', blob: 'a.1', name: '' };
    const A2 = { key: 'a', blob: 'a.2', name: '' };
    const A3 = { key: 'a', blob: 'a.3', name: '' };
    const B1 = { key: 'b', blob: 'b.1', name: '' };
    const B2 = { key: 'b', blob: 'b.2', name: '' };
    const C1 = { key: 'c', blob: 'c.1', name: '' };
    const C2 = { key: 'c', blob: 'c.2', name: '' };

    it('does nothing with empty states', () => {
      const newState = threeWayMerge([], [], []);
      expect(newState).toEqual({
        conflicts: [],
        state: [],
      });
    });

    it('adds new object from other', () => {
      const root = [A1];
      const trunk = [A1];
      const other = [A1, B1];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [],
        state: [A1, B1],
      });
    });

    it('removes object from trunk', () => {
      const root = [A1, C1];
      const trunk = [A1, C1];
      const other = [A1];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [],
        state: [A1],
      });
    });

    it('removes object from both', () => {
      const root = [A1, C1];
      const trunk = [A1];
      const other = [A1];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [],
        state: [A1],
      });
    });

    it('modifies object from other', () => {
      const root = [A1];
      const trunk = [A1];
      const other = [A2];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [],
        state: [A2],
      });
    });

    it('modifies object from trunk', () => {
      const root = [A1];
      const trunk = [A2];
      const other = [A1];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [],
        state: [A2],
      });
    });

    it('conflicts when both modify', () => {
      const root = [A1];
      const trunk = [A2];
      const other = [A3];

      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [A1.key],
        state: [A2],
      });
    });

    it('works if both add the same document', () => {
      const root = [A1];
      const trunk = [A1, B1];
      const other = [A1, B1];

      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [],
        state: [A1, B1],
      });
    });

    it('conflicts if both add the same document but different', () => {
      const root = [A1];
      const trunk = [A1, B1];
      const other = [A1, B2];

      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [B2.key],
        state: [A1, B1],
      });
    });

    it('conflicts if modified in trunk and deleted in other', () => {
      const root = [A1, B1];
      const trunk = [A1, B2];
      const other = [A1];

      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [B2.key],
        state: [A1, B2],
      });
    });

    it('conflicts if modified in other and deleted in trunk', () => {
      const root = [A1, B1];
      const trunk = [A1];
      const other = [A1, B2];

      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [B2.key],
        state: [A1, B2],
      });
    });
  });
});

function newSnapshot(n, state) {
  return {
    id: `snapshot_${n}`,
    created: new Date(),
    parent: '00000',
    author: 'author_1',
    name: `Snapshot ${n}`,
    description: `Test snapshot #${n}`,
    state,
  };
}

function newStateEntry(key, blob) {
  return {
    key,
    blob,
    name: `Blob ${key}.${blob}`,
  };
}

function newCandidate(key, n) {
  return {
    key,
    name: `Candidate ${n}`,
    content: `Content for candidate ${key}.${n}`,
  };
}
