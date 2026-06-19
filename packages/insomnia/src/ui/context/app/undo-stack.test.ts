import { beforeEach, describe, expect, it } from 'vitest';

import {
  finalizeTop,
  type PatchEntry,
  recordDelete,
  recordEdit,
  type RequestSubTab,
  resetEntryIdForTests,
  shapeOf,
  UNDO_MAX_SNAPSHOT_BYTES,
  UNDO_STACK_MAX,
  type UndoEntry,
} from './undo-stack';

const loc = (overrides: Partial<{ requestId: string; subTab: RequestSubTab }> = {}) => ({
  organizationId: 'org_1',
  projectId: 'proj_1',
  workspaceId: 'wrk_1',
  requestId: overrides.requestId ?? 'req_1',
  subTab: overrides.subTab ?? ('headers' as RequestSubTab),
});

const header = (id: string, value: string) => ({ id, name: 'X', value });

beforeEach(() => {
  resetEntryIdForTests();
});

describe('shapeOf', () => {
  it('summarizes arrays by their ids in order and scalars as "scalar"', () => {
    expect(shapeOf({ headers: [header('a', '1'), header('b', '2')], url: 'x' }, ['headers', 'url'])).toBe('a,b|scalar');
  });
});

describe('recordEdit coalescing', () => {
  it('merges consecutive value edits to the same field into one step', () => {
    const stack: UndoEntry[] = [];
    recordEdit(stack, { location: loc(), before: { headers: [header('a', '')] }, after: { headers: [header('a', 'h')] }, now: 1000 });
    const second = recordEdit(stack, { location: loc(), before: { headers: [header('a', 'h')] }, after: { headers: [header('a', 'he')] }, now: 1100 });

    expect(second.merged).toBe(true);
    expect(stack).toHaveLength(1);
    const entry = stack[0] as PatchEntry;
    // before is preserved from the first edit; after reflects the latest value
    expect(entry.before.headers[0].value).toBe('');
    expect(entry.after.headers[0].value).toBe('he');
  });

  it('starts a new step once the coalescing window elapses', () => {
    const stack: UndoEntry[] = [];
    recordEdit(stack, { location: loc(), before: { headers: [header('a', '')] }, after: { headers: [header('a', 'h')] }, now: 1000 });
    recordEdit(stack, { location: loc(), before: { headers: [header('a', 'h')] }, after: { headers: [header('a', 'he')] }, now: 5000 });
    expect(stack).toHaveLength(2);
  });

  it('does not merge across sub-tabs', () => {
    const stack: UndoEntry[] = [];
    recordEdit(stack, { location: loc({ subTab: 'params' }), before: { parameters: [header('a', '')] }, after: { parameters: [header('a', 'p')] }, now: 1000 });
    recordEdit(stack, { location: loc({ subTab: 'headers' }), before: { headers: [header('a', '')] }, after: { headers: [header('a', 'h')] }, now: 1100 });
    expect(stack).toHaveLength(2);
  });
});

describe('recordEdit structural changes are atomic', () => {
  it('adding a row creates a sealed step that later typing does not merge into', () => {
    const stack: UndoEntry[] = [];
    // add a row: shape changes from [a] -> [a,b]
    recordEdit(stack, { location: loc(), before: { headers: [header('a', '1')] }, after: { headers: [header('a', '1'), header('b', '')] }, now: 1000 });
    expect((stack[0] as PatchEntry).sealed).toBe(true);
    // type into the new row (same shape) shortly after — must not merge into the sealed add step
    recordEdit(stack, { location: loc(), before: { headers: [header('a', '1'), header('b', '')] }, after: { headers: [header('a', '1'), header('b', 'v')] }, now: 1100 });
    expect(stack).toHaveLength(2);
  });

  it('deleting a row keeps the full prior array in `before` for restore', () => {
    const stack: UndoEntry[] = [];
    recordEdit(stack, {
      location: loc(),
      before: { headers: [header('a', '1'), header('b', '2')] },
      after: { headers: [header('a', '1')] },
      now: 1000,
    });
    const entry = stack[0] as PatchEntry;
    expect(entry.sealed).toBe(true);
    expect(entry.before.headers).toHaveLength(2);
    expect(entry.before.headers[1]).toEqual(header('b', '2'));
  });

  it('reordering rows is a structural (sealed) step', () => {
    const stack: UndoEntry[] = [];
    recordEdit(stack, {
      location: loc(),
      before: { headers: [header('a', '1'), header('b', '2')] },
      after: { headers: [header('b', '2'), header('a', '1')] },
      now: 1000,
    });
    expect((stack[0] as PatchEntry).sealed).toBe(true);
  });
});

describe('stack bounds', () => {
  it('drops the oldest entry beyond UNDO_STACK_MAX', () => {
    const stack: UndoEntry[] = [];
    for (let i = 0; i < UNDO_STACK_MAX + 5; i++) {
      // each edit is structural (different id set) so none coalesce
      recordEdit(stack, {
        location: loc(),
        before: { headers: [] },
        after: { headers: [header(`id${i}`, 'v')] },
        now: 1000 + i * 10_000,
      });
    }
    expect(stack).toHaveLength(UNDO_STACK_MAX);
    // oldest (id0) dropped, newest retained
    expect((stack[stack.length - 1] as PatchEntry).after.headers[0].id).toBe(`id${UNDO_STACK_MAX + 4}`);
  });

  it('does not record edits whose snapshot exceeds the byte threshold', () => {
    const stack: UndoEntry[] = [];
    const big = 'x'.repeat(UNDO_MAX_SNAPSHOT_BYTES + 10);
    const res = recordEdit(stack, { location: loc({ subTab: 'content-type' }), before: { body: { text: '' } }, after: { body: { text: big } }, now: 1000 });
    expect(res.skipped).toBe(true);
    expect(stack).toHaveLength(0);
  });
});

describe('finalizeTop', () => {
  it('seals the current group so the next edit starts a new step', () => {
    const stack: UndoEntry[] = [];
    recordEdit(stack, { location: loc(), before: { headers: [header('a', '')] }, after: { headers: [header('a', 'h')] }, now: 1000 });
    finalizeTop(stack);
    recordEdit(stack, { location: loc(), before: { headers: [header('a', 'h')] }, after: { headers: [header('a', 'he')] }, now: 1100 });
    expect(stack).toHaveLength(2);
  });
});

describe('recordDelete', () => {
  it('pushes a sealed delete-request entry carrying the snapshots', () => {
    const stack: UndoEntry[] = [];
    const requestDoc = { _id: 'req_1', type: 'Request', name: 'R' };
    const metaDoc = { _id: 'reqm_1', type: 'RequestMeta', parentId: 'req_1' };
    recordDelete(stack, { location: loc(), requestDoc, metaDoc, now: 1000 });
    expect(stack).toHaveLength(1);
    expect(stack[0].kind).toBe('delete-request');
    expect(stack[0].sealed).toBe(true);
    if (stack[0].kind === 'delete-request') {
      expect(stack[0].requestDoc).toEqual(requestDoc);
      expect(stack[0].metaDoc).toEqual(metaDoc);
    }
  });
});
