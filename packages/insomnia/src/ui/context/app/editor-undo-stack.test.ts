import type { UndoableOperation } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { COALESCE_MS, recordOperation, sealTop, UNDO_STACK_MAX, type UndoEntry } from './editor-undo-stack';

const makeOp = (before: Record<string, any>, after: Record<string, any>, keys: string[]): UndoableOperation => ({
  apply: { kind: 'update', doc: { _id: 'req_1', type: 'Request', ...after } as any },
  invert: { kind: 'update', doc: { _id: 'req_1', type: 'Request', ...before } as any },
  keys,
});

describe('recordOperation', () => {
  it('pushes a new entry onto an empty stack', () => {
    const undo: UndoEntry[] = [];
    const result = recordOperation(undo, makeOp({ url: 'a' }, { url: 'ab' }, ['url']), 0);
    expect(result.merged).toBe(false);
    expect(undo).toHaveLength(1);
  });

  it('coalesces consecutive edits to the same field within the window', () => {
    const undo: UndoEntry[] = [];
    recordOperation(undo, makeOp({ url: 'a' }, { url: 'ab' }, ['url']), 0);
    const result = recordOperation(undo, makeOp({ url: 'ab' }, { url: 'abc' }, ['url']), 100);

    expect(result.merged).toBe(true);
    expect(undo).toHaveLength(1);
    // Keeps the oldest before-state and the newest after-state.
    expect(undo[0].operation.invert.doc).toMatchObject({ url: 'a' });
    expect(undo[0].operation.apply.doc).toMatchObject({ url: 'abc' });
  });

  it('starts a new entry once the coalescing window has passed', () => {
    const undo: UndoEntry[] = [];
    recordOperation(undo, makeOp({ url: 'a' }, { url: 'ab' }, ['url']), 0);
    const result = recordOperation(undo, makeOp({ url: 'ab' }, { url: 'abc' }, ['url']), COALESCE_MS + 1);

    expect(result.merged).toBe(false);
    expect(undo).toHaveLength(2);
  });

  it('does not coalesce edits to different fields', () => {
    const undo: UndoEntry[] = [];
    recordOperation(undo, makeOp({ url: 'a' }, { url: 'ab' }, ['url']), 0);
    const result = recordOperation(undo, makeOp({ description: '' }, { description: 'x' }, ['description']), 50);

    expect(result.merged).toBe(false);
    expect(undo).toHaveLength(2);
  });

  it('treats an array shape change (add/remove row) as a sealed, atomic step', () => {
    const undo: UndoEntry[] = [];
    // Adding a row changes the array shape, so it must not merge with a subsequent value edit.
    recordOperation(undo, makeOp({ headers: [{ id: '1' }] }, { headers: [{ id: '1' }, { id: '2' }] }, ['headers']), 0);
    expect(undo[0].sealed).toBe(true);

    const result = recordOperation(
      undo,
      makeOp({ headers: [{ id: '1' }, { id: '2' }] }, { headers: [{ id: '1' }, { id: '2', value: 'v' }] }, ['headers']),
      50,
    );
    expect(result.merged).toBe(false);
    expect(undo).toHaveLength(2);
  });

  it('coalesces value edits within an array of stable shape', () => {
    const undo: UndoEntry[] = [];
    recordOperation(undo, makeOp({ headers: [{ id: '1', value: 'a' }] }, { headers: [{ id: '1', value: 'ab' }] }, ['headers']), 0);
    const result = recordOperation(
      undo,
      makeOp({ headers: [{ id: '1', value: 'ab' }] }, { headers: [{ id: '1', value: 'abc' }] }, ['headers']),
      50,
    );
    expect(result.merged).toBe(true);
    expect(undo).toHaveLength(1);
  });

  it('enforces the max stack size by dropping the oldest entry', () => {
    const undo: UndoEntry[] = [];
    for (let i = 0; i < UNDO_STACK_MAX + 5; i++) {
      // Space edits past the window so each becomes its own entry.
      recordOperation(undo, makeOp({ url: String(i) }, { url: String(i + 1) }, ['url']), i * (COALESCE_MS + 1));
    }
    expect(undo).toHaveLength(UNDO_STACK_MAX);
    // Oldest dropped: the first surviving entry should no longer revert to '0'.
    expect(undo[0].operation.invert.doc).not.toMatchObject({ url: '0' });
  });
});

describe('sealTop', () => {
  it('seals the top entry so the next edit will not coalesce', () => {
    const undo: UndoEntry[] = [];
    recordOperation(undo, makeOp({ url: 'a' }, { url: 'ab' }, ['url']), 0);
    sealTop(undo);
    const result = recordOperation(undo, makeOp({ url: 'ab' }, { url: 'abc' }, ['url']), 50);
    expect(result.merged).toBe(false);
    expect(undo).toHaveLength(2);
  });
});
