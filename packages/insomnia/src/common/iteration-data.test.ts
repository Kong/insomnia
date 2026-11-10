import type { UserUploadEnvironment } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { wrapAroundIterationOverIterationData } from './iteration-data';

const row = (name: string): UserUploadEnvironment => ({ name, data: { name }, dataPropertyOrder: null });

describe('wrapAroundIterationOverIterationData', () => {
  const rows = ['row1', 'row2'].map(row);

  it('uses each data row once before wrapping around', () => {
    const names = [0, 1, 2, 3].map(i => wrapAroundIterationOverIterationData(rows, i)?.name);

    expect(names).toEqual(['row1', 'row2', 'row1', 'row2']);
  });

  it('wraps around when iterations exceed the number of rows', () => {
    const threeRows = ['row1', 'row2', 'row3'].map(row);
    const names = [0, 1, 2, 3, 4].map(i => wrapAroundIterationOverIterationData(threeRows, i)?.name);

    expect(names).toEqual(['row1', 'row2', 'row3', 'row1', 'row2']);
  });

  it('returns undefined without iteration data', () => {
    expect(wrapAroundIterationOverIterationData(undefined, 0)).toBeUndefined();
    expect(wrapAroundIterationOverIterationData([], 0)).toBeUndefined();
    expect(wrapAroundIterationOverIterationData(rows)).toBeUndefined();
  });
});
