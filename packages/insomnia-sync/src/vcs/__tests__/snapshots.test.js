import { combinedMapKeys, generateCandidateMap, generateStateMap } from '../snapshots';

describe('snapshots', () => {
  describe('generateStateMap()', () => {
    it('generates from simple states', async () => {
      const snapshot = newSnapshot(1, [
        newStateEntry('doc_1', 'blob_1'),
        newStateEntry('doc_2', 'blob_2'),
      ]);

      const map = generateStateMap(snapshot);
      expect(Object.keys(map).sort()).toEqual(['doc_1', 'doc_2']);
    });

    it('works with duplicates', async () => {
      const snapshot = newSnapshot(1, [
        newStateEntry('doc_1', 'blob_1'),
        newStateEntry('doc_2', 'blob_2'),
        newStateEntry('doc_2', 'blob_2'),
        newStateEntry('doc_2', 'blob_2'),
      ]);

      const map = generateStateMap(snapshot);
      expect(Object.keys(map).sort()).toEqual(['doc_1', 'doc_2']);
    });

    it('works with null snapshots', async () => {
      const map = generateStateMap(null);
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
      const map1 = generateStateMap(
        newSnapshot(1, [newStateEntry('doc_1', 'blob_1'), newStateEntry('doc_2', 'blob_2')]),
      );
      const map2 = generateStateMap(
        newSnapshot(1, [newStateEntry('doc_4', 'blob_4'), newStateEntry('doc_1', 'blob_1')]),
      );
      const map3 = generateStateMap(newSnapshot(1, []));

      const keys = combinedMapKeys(map1, map2, map3);
      expect(keys.sort()).toEqual(['doc_1', 'doc_2', 'doc_4']);
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
});
