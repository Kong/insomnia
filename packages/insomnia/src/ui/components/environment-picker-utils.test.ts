import { describe, expect, it } from 'vitest';

import { filterProjectEnvironmentItems } from './environment-picker-utils';

// Mirrors how the picker flattens the project environments: a file row followed by its own
// sub-environment rows, with the "no selection" row pinned to the top.
const items = [
  { id: '', name: 'No Project Environment', icon: 'cancel' as const, isBase: true },
  { id: 'env_payments', name: 'Payments', icon: 'file-arrow-down' as const, isBase: true, workspaceId: 'wrk_payments' },
  {
    id: 'env_payments_prod',
    name: 'Production',
    icon: 'file-arrow-down' as const,
    isBase: false,
    parentId: 'env_payments',
  },
  {
    id: 'env_payments_stg',
    name: 'Staging',
    icon: 'file-arrow-down' as const,
    isBase: false,
    parentId: 'env_payments',
  },
  { id: 'env_billing', name: 'Billing', icon: 'file-arrow-down' as const, isBase: true, workspaceId: 'wrk_billing' },
  { id: 'env_billing_eu', name: 'EU region', icon: 'file-arrow-down' as const, isBase: false, parentId: 'env_billing' },
];

const names = (filter: string) => filterProjectEnvironmentItems(items, filter).map(item => item.name);

describe('filterProjectEnvironmentItems', () => {
  it('returns every row when the filter is empty or whitespace', () => {
    expect(filterProjectEnvironmentItems(items, '')).toEqual(items);
    expect(filterProjectEnvironmentItems(items, '   ')).toEqual(items);
  });

  it('narrows the list to the matching file and its sub-environments', () => {
    expect(names('Billing')).toEqual(['Billing', 'EU region']);
  });

  it('keeps the parent file visible when only a sub-environment matches', () => {
    expect(names('Staging')).toEqual(['Payments', 'Staging']);
  });

  it('matches case-insensitively and on partial names', () => {
    expect(names('pay')).toEqual(['Payments', 'Production', 'Staging']);
  });

  it('returns nothing when no name matches', () => {
    expect(names('zzzzz')).toEqual([]);
  });
});
