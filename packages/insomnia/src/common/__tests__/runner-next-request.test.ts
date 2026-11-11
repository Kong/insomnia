import { describe, expect, it } from 'vitest';

import { findNextRequestIndex } from '../runner-next-request';

const requests = [
  { id: 'req_1', name: 'create user' },
  { id: 'req_2', name: 'update user' },
  { id: 'req_3', name: 'check user' },
  { id: 'req_4', name: 'delete user' },
];

describe('findNextRequestIndex()', () => {
  it('finds a request that comes before the current one', () => {
    expect(findNextRequestIndex(requests, 'create user')).toBe(0);
    expect(findNextRequestIndex(requests, 'req_1')).toBe(0);
  });

  it('finds a request that comes after the current one', () => {
    expect(findNextRequestIndex(requests, 'delete user')).toBe(3);
    expect(findNextRequestIndex(requests, 'req_3')).toBe(2);
  });

  it('ignores surrounding whitespace', () => {
    expect(findNextRequestIndex(requests, '  update user ')).toBe(1);
    expect(findNextRequestIndex([{ id: 'req_1', name: ' padded ' }], 'padded')).toBe(0);
  });

  it('prefers an id match over a name match', () => {
    const tricky = [
      { id: 'req_a', name: 'req_b' },
      { id: 'req_b', name: 'second' },
    ];
    expect(findNextRequestIndex(tricky, 'req_b')).toBe(1);
  });

  it('uses the last request when several share the same name', () => {
    const duplicated = [
      { id: 'req_1', name: 'login' },
      { id: 'req_2', name: 'fetch' },
      { id: 'req_3', name: 'login' },
    ];
    expect(findNextRequestIndex(duplicated, 'login')).toBe(2);
  });

  it('returns -1 when nothing matches', () => {
    expect(findNextRequestIndex(requests, 'missing')).toBe(-1);
    expect(findNextRequestIndex(requests, '')).toBe(-1);
    expect(findNextRequestIndex([], 'create user')).toBe(-1);
  });
});
