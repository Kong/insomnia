import { createBuilder } from '@develohpanda/fluent-builder';

import { baseModelSchema, workspaceModelSchema } from '../../../models/__schemas__/model-schemas';
import { branchSchema, mergeConflictSchema, statusCandidateSchema } from '../../__schemas__/type-schemas';
import { StageEntry } from '../../types';
import {
  combinedMapKeys,
  compareBranches,
  generateCandidateMap,
  generateSnapshotStateMap,
  getRootSnapshot,
  getStagable,
  hash,
  hashDocument,
  interceptAccessError,
  preMergeCheck,
  stateDelta,
  threeWayMerge,
  updateStateWithConflictResolutions,
} from '../util';

const statusCandidateBuilder = createBuilder(statusCandidateSchema);
const baseModelBuilder = createBuilder(baseModelSchema);
const workspaceModelBuilder = createBuilder(workspaceModelSchema);
const mergeConflictBuilder = createBuilder(mergeConflictSchema);
const branchBuilder = createBuilder(branchSchema);

describe('util', () => {
  beforeEach(() => {
    statusCandidateBuilder.reset();
    baseModelBuilder.reset();
    mergeConflictBuilder.reset();
    branchBuilder.reset();
    workspaceModelBuilder.reset();
  });

  const DA1 = statusCandidateBuilder.reset()
    .key('a')
    .document(baseModelBuilder.reset()._id('a').name('1').build())
    .build();
  const DA2 = statusCandidateBuilder.reset()
    .key('a')
    .document(baseModelBuilder.reset()._id('a').name('2').build())
    .build();
  const DB1 = statusCandidateBuilder.reset()
    .key('b')
    .document(baseModelBuilder.reset()._id('b').name('1').build())
    .build();
  const DB2 = statusCandidateBuilder.reset()
    .key('b')
    .document(baseModelBuilder.reset()._id('b').name('2').build())
    .build();
  const DC1 = statusCandidateBuilder.reset()
    .key('c')
    .document(baseModelBuilder.reset()._id('c').name('1').build())
    .build();

  const HA1 = hashDocument(DA1.document);
  const HA2 = hashDocument(DA2.document);
  const HB1 = hashDocument(DB1.document);
  const HB2 = hashDocument(DB2.document);
  const HC1 = hashDocument(DC1.document);

  const A1 = {
    key: DA1.key,
    blob: HA1.hash,
    name: '',
  };
  const A2 = {
    key: DA2.key,
    blob: HA2.hash,
    name: '',
  };
  const B1 = {
    key: DB1.key,
    blob: HB1.hash,
    name: '',
  };
  const B2 = {
    key: DB2.key,
    blob: HB2.hash,
    name: '',
  };
  const C1 = {
    key: DC1.key,
    blob: HC1.hash,
    name: '',
  };

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
    const A1 = {
      key: 'a',
      blob: 'a.1',
      name: '',
    };
    const A2 = {
      key: 'a',
      blob: 'a.2',
      name: '',
    };
    const A3 = {
      key: 'a',
      blob: 'a.3',
      name: '',
    };
    const B1 = {
      key: 'b',
      blob: 'b.1',
      name: '',
    };
    const B2 = {
      key: 'b',
      blob: 'b.2',
      name: '',
    };
    const C1 = {
      key: 'c',
      blob: 'c.1',
      name: '',
    };

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
        conflicts: [
          {
            key: A2.key,
            name: A2.name,
            choose: A3.blob,
            mineBlob: A2.blob,
            theirsBlob: A3.blob,
            message: 'both modified',
          },
        ],
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
        conflicts: [
          {
            key: B1.key,
            name: B1.name,
            choose: B2.blob,
            mineBlob: B1.blob,
            theirsBlob: B2.blob,
            message: 'both added',
          },
        ],
        state: [A1, B1],
      });
    });

    it('conflicts if modified in trunk and deleted in other', () => {
      const root = [A1, B1];
      const trunk = [A1, B2];
      const other = [A1];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [
          {
            key: B1.key,
            name: B1.name,
            choose: B2.blob,
            mineBlob: B2.blob,
            theirsBlob: null,
            message: 'they deleted and you modified',
          },
        ],
        state: [A1, B2],
      });
    });

    it('conflicts if modified in other and deleted in trunk', () => {
      const root = [A1, B1];
      const trunk = [A1];
      const other = [A1, B2];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [
          {
            key: B1.key,
            name: B1.name,
            choose: B2.blob,
            mineBlob: null,
            theirsBlob: B2.blob,
            message: 'you deleted and they modified',
          },
        ],
        state: [A1, B2],
      });
    });

    it('works with no root state', () => {
      const root = [];
      const trunk = [A1, C1];
      const other = [A1, B2];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [],
        state: expect.arrayContaining([A1, B2, C1]),
      });
    });

    it('works with no root state and conflict', () => {
      const root = [];
      const trunk = [A1];
      const other = [A2];
      expect(threeWayMerge(root, trunk, other)).toEqual({
        conflicts: [
          {
            key: A1.key,
            name: A1.name,
            choose: A2.blob,
            mineBlob: A1.blob,
            theirsBlob: A2.blob,
            message: 'both added',
          },
        ],
        state: [A1],
      });
    });
  });

  describe('stateDelta()', () => {
    const A1 = {
      key: 'a',
      blob: 'a.1',
      name: '',
    };
    const A2 = {
      key: 'a',
      blob: 'a.2',
      name: '',
    };
    const B1 = {
      key: 'b',
      blob: 'b.1',
      name: '',
    };
    const B2 = {
      key: 'b',
      blob: 'b.2',
      name: '',
    };
    const C1 = {
      key: 'c',
      blob: 'c.1',
      name: '',
    };

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
    it('works with empty state', () => {
      const state = [];
      const dsrd = [DA1];
      expect(getStagable(state, dsrd)).toEqual<StageEntry[]>([
        {
          blobContent: HA1.content,
          blobId: HA1.hash,
          key: A1.key,
          name: DA1.name,
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
          key: B1.key,
          blobId: HB1.hash,
          blobContent: HB1.content,
          name: DB1.name,
          added: true,
        },
      ]);
    });

    it('modifies a document', () => {
      const state = [B1];
      const dsrd = [DB2];
      expect(getStagable(state, dsrd)).toEqual([
        {
          key: B2.key,
          blobId: HB2.hash,
          blobContent: HB2.content,
          name: DB2.name,
          modified: true,
        },
      ]);
    });

    it('deletes a document', () => {
      const state = [B1];
      const dsrd = [];
      expect(getStagable(state, dsrd)).toEqual([
        {
          key: B1.key,
          blobId: HB1.hash,
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
          blobContent: HA2.content,
          blobId: HA2.hash,
          key: A2.key,
          modified: true,
          name: DA2.name,
        },
        {
          key: C1.key,
          blobId: HC1.hash,
          name: '',
          deleted: true,
        },
        {
          key: B1.key,
          blobId: HB1.hash,
          blobContent: HB1.content,
          name: DB1.name,
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

  describe('updateStateWithConflictResolutions()', () => {
    const D1 = {
      key: 'd',
      blob: 'f23ac59e6e11db7d35b96291b823e674b6b1890e',
      name: '',
    };
    const E1 = {
      key: 'e',
      blob: '1db7d35b96291f23ac59e6e1b823e674b6b1890e',
      name: '',
    };
    const F1 = {
      key: 'f',
      blob: '6291b823e674b6b137172d35b9f23ac59e6e190e',
      name: '',
    };

    it('does it', () => {
      const state = [A1, B1, E1, F1];
      const conflicts = [
        mergeConflictBuilder.reset()
          .key(A1.key)
          .name(A1.name)
          .mineBlob(A1.blob)
          .theirsBlob(A2.blob)
          .choose(A1.blob)
          .build(),
        mergeConflictBuilder.reset()
          .key(B1.key)
          .name(B1.name)
          .mineBlob(B1.blob)
          .theirsBlob(null)
          .choose(null)
          .build(),
        mergeConflictBuilder.reset()
          .key(C1.key)
          .name(C1.name)
          .mineBlob(null)
          .theirsBlob(C1.blob)
          .choose(C1.blob)
          .build(),
        mergeConflictBuilder.reset()
          .key(D1.key)
          .name(D1.name)
          .mineBlob(D1.blob)
          .theirsBlob(null)
          .choose(null)
          .build(),
      ];
      expect(updateStateWithConflictResolutions(state, conflicts)).toEqual([A1, E1, F1, C1]);
    });
  });

  describe('preMergeCheck()', () => {
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

  describe('compareBranches()', () => {
    it('empty states are the same', () => {
      const a = newBranch([]);
      const b = newBranch([]);
      expect(compareBranches(a, b)).toEqual({
        ahead: 0,
        behind: 0,
      });
    });

    it('works with other empty', () => {
      const a = newBranch([]);
      const b = newBranch(['1']);
      expect(compareBranches(a, b)).toEqual({
        ahead: 0,
        behind: 1,
      });
    });

    it('works with both null', () => {
      const a = null;
      const b = null;
      expect(compareBranches(a, b)).toEqual({
        ahead: 0,
        behind: 0,
      });
    });

    it('works with null', () => {
      const a = null;
      const b = newBranch(['1']);
      expect(compareBranches(a, b)).toEqual({
        ahead: 0,
        behind: 1,
      });
    });

    it('works with other null', () => {
      const a = newBranch(['1']);
      const b = null;
      expect(compareBranches(a, b)).toEqual({
        ahead: 1,
        behind: 0,
      });
    });

    it('works with one empty', () => {
      const a = newBranch(['1']);
      const b = newBranch([]);
      expect(compareBranches(a, b)).toEqual({
        ahead: 1,
        behind: 0,
      });
    });

    it('same states are the same', () => {
      const a = newBranch(['1']);
      const b = newBranch(['1']);
      expect(compareBranches(a, b)).toEqual({
        ahead: 0,
        behind: 0,
      });
    });

    it('same final states are the same', () => {
      const a = newBranch(['1', '2']);
      const b = newBranch(['0', '2']);
      expect(compareBranches(a, b)).toEqual({
        ahead: 0,
        behind: 0,
      });
    });

    it('subset of B is ahead', () => {
      const a = newBranch(['1', '2', '3']);
      const b = newBranch(['0', '2']);
      expect(compareBranches(a, b)).toEqual({
        ahead: 1,
        behind: 0,
      });
    });

    it('subset of A is behind', () => {
      const a = newBranch(['1', '2']);
      const b = newBranch(['0', '2', '3']);
      expect(compareBranches(a, b)).toEqual({
        ahead: 0,
        behind: 1,
      });
    });

    it('states have diverged', () => {
      const a = newBranch(['1', '2', '3', '5']);
      const b = newBranch(['0', '2', '3', '4']);
      expect(compareBranches(a, b)).toEqual({
        ahead: 1,
        behind: 1,
      });
    });

    it('states have diverged scenario 2', () => {
      const a = newBranch(['1', '2', '3', '5', '9']);
      const b = newBranch(['0', '2', '3', '4', '8', '11']);
      expect(compareBranches(a, b)).toEqual({
        ahead: 2,
        behind: 3,
      });
    });
  });

  describe('hash()', () => {
    it('ignore object key order', () => {
      const result1 = hash({
        c: 'c',
        a: 'a',
        b: 'b',
      });
      const result2 = hash({
        a: 'a',
        b: 'b',
        c: 'c',
      });
      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash).toBe('fed03259e8027e1fab2e2e57b402671bef7f3eb9');
      expect(result2.hash).toBe('fed03259e8027e1fab2e2e57b402671bef7f3eb9');
      expect(result1.content).toBe('{"a":"a","b":"b","c":"c"}');
      expect(result2.content).toBe('{"a":"a","b":"b","c":"c"}');
    });

    it('works on recursive things', () => {
      const result1 = hash({
        arr: [
          {
            b: 'b',
            a: 'a',
          },
        ],
        obj: {
          obj2: {
            b: 'b',
            a: 'a',
          },
        },
      });
      const result2 = hash({
        arr: [
          {
            b: 'b',
            a: 'a',
          },
        ],
        obj: {
          obj2: {
            a: 'a',
            b: 'b',
          },
        },
      });
      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash).toBe('7eaaa8a03bada54b403aeada681aad6892a28ab3');
      expect(result2.hash).toBe('7eaaa8a03bada54b403aeada681aad6892a28ab3');
      expect(result1.content).toBe(
        '{"arr":[{"a":"a","b":"b"}],"obj":{"obj2":{"a":"a","b":"b"}}}',
      );
      expect(result2.content).toBe(
        '{"arr":[{"a":"a","b":"b"}],"obj":{"obj2":{"a":"a","b":"b"}}}',
      );
    });

    it('array order matters', () => {
      const result1 = hash(['c', 'a', 'b']);
      const result2 = hash(['a', 'b', 'c']);
      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.hash).toBe('edf94aad27c26bdcfe7477e0ed68991cbaedf8d8');
      expect(result2.hash).toBe('e13460afb1e68af030bb9bee8344c274494661fa');
      expect(result1.content).toBe('["c","a","b"]');
      expect(result2.content).toBe('["a","b","c"]');
    });

    it('works with strange types', () => {
      const sDate1 = hash(new Date(1541178019555));
      const sDate2 = hash('2018-11-02T17:00:19.555Z');
      expect(sDate1.hash).toBe(sDate2.hash);
      expect(sDate1.hash).toBe('ec0a18c47fb39de00204c57b5b492fd408394a01');
      expect(sDate2.hash).toBe('ec0a18c47fb39de00204c57b5b492fd408394a01');
      expect(sDate1.content).toBe('"2018-11-02T17:00:19.555Z"');
      expect(sDate2.content).toBe('"2018-11-02T17:00:19.555Z"');
      const sNull2 = hash('null');
      expect(sNull2.hash).toBe('8c1030365643f1f4b7f00e3d88c0a3c555522b60');
      expect(sNull2.content).toBe('"null"');
    });

    it('skips non-json types', () => {
      const sFunc1 = hash({
        a: [0, () => null],
        fn: () => null,
      });
      const sFunc2 = hash({
        a: [0],
      });
      expect(sFunc1.hash).toBe(sFunc2.hash);
      expect(sFunc1.hash).toBe('38b742facb1034438d82cf1e294d9e71051bf120');
      expect(sFunc2.hash).toBe('38b742facb1034438d82cf1e294d9e71051bf120');
      expect(sFunc1.content.toString()).toBe('{"a":[0]}');
      expect(sFunc2.content.toString()).toBe('{"a":[0]}');
    });

    it('fails on undefined', () => {
      expect(() => hash(undefined)).toThrowError('Cannot hash undefined value');
      expect(() => hash()).toThrowError('Cannot hash undefined value');
    });
  });
  describe('hashDocument()', () => {
    it('fails on undefined', () => {
      expect(() => hashDocument(undefined)).toThrowError('Cannot hash undefined value');
      expect(() => hashDocument()).toThrowError('Cannot hash undefined value');
    });

    it('ignores global object keys that do not matter', () => {
      const result1 = hashDocument(
        baseModelBuilder.modified(123).parentId('abc').build(),
      );
      const result2 = hashDocument(
        baseModelBuilder.modified(456).build(),
      );
      const result3 = hashDocument(
        baseModelBuilder.name('abc').modified(456).build(),
      );
      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash).not.toBe(result3.hash);
    });

    it('shouldnt change the hash of a workspace after a parent id is added and ignored', () => {
      // Arrange
      // @ts-expect-error parentId is intentionally null, because that's what the data was originally
      const originalSyncedWorkspace = workspaceModelBuilder.parentId(null).build();

      // Existing synced workspaces do not have a modified field
      // @ts-expect-error delete non-optional
      delete originalSyncedWorkspace.modified;

      // intentionally hash and not hashDocument, to bypass ignoring logic
      const original = hash(originalSyncedWorkspace);

      // Act
      const withParent = hashDocument(
        workspaceModelBuilder.parentId('abc').build(),
      );
      const unique = hashDocument(
        workspaceModelBuilder.name('unique').parentId('abc').build(),
      );

      // Assert
      expect(original.hash).toBe(withParent.hash);
      expect(original.hash).not.toBe(unique.hash);
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

const newCandidate = (key: string, n: number) => statusCandidateBuilder
  .reset()
  .key(key)
  .name(`Candidate ${n}`)
  .document(baseModelBuilder.reset().name(`Content for candidate ${key}.${n}`).build())
  .build();

const newBranch = (snapshots: string[]) => branchBuilder.snapshots(snapshots).build();

describe('interceptAccessError', () => {
  it('intercepts an error', async () => {
    // Arrange

    // Act
    const action = async () => await interceptAccessError({
      action: 'action',
      callback: () => {
        throw new Error('DANGER! invalid access to the fifth dimensional nebulo 9.');
      },
      resourceName: 'resourceName',
      resourceType: 'resourceType',
    }) as Error;

    // Assert
    const result = expect(action).rejects;
    result.toBeInstanceOf(Error);
    result.toThrowError('You no longer have permission to action the "resourceName" resourceType.  Contact your team administrator if you think this is an error.');
  });

  it('does not intercept errors it doesn\'t care about', async () => {
    // Arrange
    const message = 'Having been rejected by the planet smasher, Ziltoid seeks the council of the omnidimensional creator.';

    // Act
    const action = async () => await interceptAccessError({
      action: 'action',
      callback: () => { throw new Error(message); },
      resourceName: 'resourceName',
      resourceType: 'resourceType',
    }) as Error;

    // Assert
    const result = expect(action).rejects;
    result.toBeInstanceOf(Error);
    result.toThrowError(message);
  });
});
