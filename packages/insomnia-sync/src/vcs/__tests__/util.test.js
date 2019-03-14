import {
  combinedMapKeys,
  generateCandidateMap,
  generateSnapshotStateMap,
  getRootSnapshot,
  getStagable,
  preMergeCheck,
  stateDelta,
  threeWayMerge,
} from '../util';

describe('util', () => {
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

  describe('stateDelta()', () => {
    const A1 = { key: 'a', blob: 'a.1', name: '' };
    const A2 = { key: 'a', blob: 'a.2', name: '' };
    const B1 = { key: 'b', blob: 'b.1', name: '' };
    const B2 = { key: 'b', blob: 'b.2', name: '' };
    const C1 = { key: 'c', blob: 'c.1', name: '' };

    it('modifies an entry', () => {
      const base = [A1];
      const dsrd = [A2];

      expect(stateDelta(base, dsrd)).toEqual({
        add: [],
        update: [A2],
        remove: [],
      });
    });

    it('adds an entry', () => {
      const base = [];
      const dsrd = [B1];

      expect(stateDelta(base, dsrd)).toEqual({
        add: [B1],
        update: [],
        remove: [],
      });
    });

    it('deletes an entry', () => {
      const base = [A1];
      const dsrd = [];

      expect(stateDelta(base, dsrd)).toEqual({
        add: [],
        update: [],
        remove: [A1],
      });
    });

    it('complex combo', () => {
      const base = [A1, B1, C1];
      const dsrd = [B2, C1];

      expect(stateDelta(base, dsrd)).toEqual({
        add: [],
        update: [B2],
        remove: [A1],
      });
    });

    it('invalid duplicate key state', () => {
      const base = [A1, A2];
      const dsrd = [A2];

      expect(stateDelta(base, dsrd)).toEqual({
        add: [],
        update: [],
        remove: [],
      });
    });
  });

  describe('getStagable()', () => {
    const A1 = { key: 'a', blob: '1932cc749f57a77ba4a231d62559c47ee931ee2c', name: '' };
    const A2 = { key: 'a', blob: 'cf2ec18c2e686b4c966725f30050120d42d4b2e5', name: '' };
    const B1 = { key: 'b', blob: '05ab2ec03c7e32eff27305b4a11c573a3843fa01', name: '' };
    const B2 = { key: 'b', blob: 'eb157a78ebd367a004c5a32a18d6d8c18e60ce00', name: '' };
    const C1 = { key: 'c', blob: 'db7d35b96291b823e674bf23ac59e6e116b1890e', name: '' };
    const DA1 = { key: 'a', document: { id: 'a', v: 1 }, name: '' };
    const DA2 = { key: 'a', document: { id: 'a', v: 2 }, name: '' };
    const DB1 = { key: 'b', document: { id: 'b', v: 1 }, name: '' };
    const DB2 = { key: 'b', document: { id: 'b', v: 2 }, name: '' };
    const DC1 = { key: 'c', document: { id: 'c', v: 1 }, name: '' };

    it('works with empty state', () => {
      const state = [];
      const dsrd = [DA1];

      expect(getStagable(state, dsrd)).toEqual([
        {
          blobContent: '{"id":"a","v":1}',
          blobId: A1.blob,
          key: 'a',
          name: '',
          added: true,
        },
      ]);
    });

    it('stays the same', () => {
      const state = [A1, B1, C1];
      const dsrd = [DA1, DB1, DC1];

      expect(getStagable(state, dsrd)).toEqual([]);
    });

    it('adds a document', () => {
      const state = [A1];
      const dsrd = [DA1, DB1];

      expect(getStagable(state, dsrd)).toEqual([
        {
          key: 'b',
          blobId: B1.blob,
          blobContent: '{"id":"b","v":1}',
          name: '',
          added: true,
        },
      ]);
    });

    it('modifies a document', () => {
      const state = [B1];
      const dsrd = [DB2];

      expect(getStagable(state, dsrd)).toEqual([
        {
          key: 'b',
          blobId: B2.blob,
          blobContent: '{"id":"b","v":2}',
          name: '',
          modified: true,
        },
      ]);
    });

    it('deletes a document', () => {
      const state = [B1];
      const dsrd = [];

      expect(getStagable(state, dsrd)).toEqual([
        {
          key: 'b',
          blobId: '05ab2ec03c7e32eff27305b4a11c573a3843fa01',
          name: '',
          deleted: true,
        },
      ]);
    });

    it('does a lot of things', () => {
      const state = [A1, C1];
      const dsrd = [DA2, DB1];

      expect(getStagable(state, dsrd)).toEqual([
        {
          blobContent: '{"id":"a","v":2}',
          blobId: A2.blob,
          key: 'a',
          modified: true,
          name: '',
        },
        {
          key: 'c',
          blobId: 'db7d35b96291b823e674bf23ac59e6e116b1890e',
          name: '',
          deleted: true,
        },
        {
          key: 'b',
          blobId: B1.blob,
          blobContent: '{"id":"b","v":1}',
          name: '',
          added: true,
        },
      ]);
    });
  });

  describe('getRootSnapshot()', () => {
    it('works with empty states', () => {
      const a = newBranch([]);
      const b = newBranch([]);

      expect(getRootSnapshot(a, b)).toBeNull();
    });

    it('works with different states', () => {
      const a = newBranch(['s1', 's2']);
      const b = newBranch(['s3', 's5']);

      expect(getRootSnapshot(a, b)).toBeNull();
    });

    it('works with same states', () => {
      const a = newBranch(['s1', 's2', 's3']);
      const b = newBranch(['s1', 's2', 's3']);

      expect(getRootSnapshot(a, b)).toBe('s3');
    });

    it('works with subset', () => {
      const a = newBranch(['s1']);
      const b = newBranch(['s1', 's2', 's3']);

      expect(getRootSnapshot(a, b)).toBe('s1');
      expect(getRootSnapshot(b, a)).toBe('s1');
    });

    it('works with missing middle', () => {
      const a = newBranch(['s1', 's3', 's4']);
      const b = newBranch(['s1', 's2', 's3', 's6']);

      expect(getRootSnapshot(a, b)).toBe('s3');
      expect(getRootSnapshot(b, a)).toBe('s3');
    });

    it('works with missing middle', () => {
      const a = newBranch(['s1', 's3']);
      const b = newBranch(['s1', 's2', 's3']);

      expect(getRootSnapshot(a, b)).toBe('s3');
      expect(getRootSnapshot(b, a)).toBe('s3');
    });
  });

  describe('preMergeCheck()', () => {
    const A1 = { key: 'a', blob: '1932cc749f57a77ba4a231d62559c47ee931ee2c', name: '' };
    const A2 = { key: 'a', blob: 'cf2ec18c2e686b4c966725f30050120d42d4b2e5', name: '' };
    const B1 = { key: 'b', blob: '05ab2ec03c7e32eff27305b4a11c573a3843fa01', name: '' };
    const B2 = { key: 'b', blob: 'eb157a78ebd367a004c5a32a18d6d8c18e60ce00', name: '' };
    const DA1 = { key: 'a', document: { id: 'a', v: 1 }, name: '' };
    const DA2 = { key: 'a', document: { id: 'a', v: 2 }, name: '' };
    const DB1 = { key: 'b', document: { id: 'b', v: 1 }, name: '' };
    const DC1 = { key: 'c', document: { id: 'c', v: 1 }, name: '' };

    it('no changes', () => {
      const trunk = [A1];
      const other = [A1];
      const cands = [DA1];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [],
        dirty: [],
      });
    });

    it('candidates same as trunk but not other', () => {
      const trunk = [A1, B1];
      const other = [A2, B2];
      const cands = [DA1, DB1];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [],
        dirty: [],
      });
    });

    it('candidate does not exist but trunk and other do', () => {
      const trunk = [A1];
      const other = [A1];
      const cands = [];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [],
        dirty: [],
      });
    });

    it('candidate different than trunk and other does not exist', () => {
      const trunk = [A1];
      const other = [];
      const cands = [DA2];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [DA2],
        dirty: [],
      });
    });

    it('candidate different than other and trunk does not exist', () => {
      const trunk = [];
      const other = [A1];
      const cands = [DA2];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [DA2],
        dirty: [],
      });
    });

    it('candidate modified but trunk and other are same', () => {
      const trunk = [A1];
      const other = [A1];
      const cands = [DA2];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [],
        dirty: [DA2],
      });
    });

    it('candidate not same as trunk but same as other', () => {
      const trunk = [A1];
      const other = [A2];
      const cands = [DA2];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [],
        dirty: [],
      });
    });

    it('candidate not same as other but same as trunk', () => {
      const trunk = [A1];
      const other = [A2];
      const cands = [DA1];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [],
        dirty: [],
      });
    });

    it('candidate not same as trunk and not in other', () => {
      const trunk = [A1];
      const other = [];
      const cands = [DA2];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [DA2],
        dirty: [],
      });
    });

    it('candidate outside of history', () => {
      const trunk = [A1];
      const other = [A2];
      const cands = [DC1];

      expect(preMergeCheck(trunk, other, cands)).toEqual({
        conflicts: [],
        dirty: [DC1],
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

function newBranch(snapshots) {
  return {
    name: '',
    created: new Date(0),
    modified: new Date(0),
    snapshots,
  };
}
