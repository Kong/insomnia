import type { ResolutionSource } from 'insomnia-vcs';

export class UserAbortResolveMergeConflictError extends Error {
  constructor(message = 'User aborted merge') {
    super(message);
  }

  name = 'UserAbortResolveMergeConflictError';
}

export const isUserAbortResolveMergeConflictError = (error: unknown): error is UserAbortResolveMergeConflictError =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'UserAbortResolveMergeConflictError';

type UnionToObject<T extends string> = {
  [K in T as Uppercase<K>]: K;
};

export const RESOLUTION_SOURCE: UnionToObject<ResolutionSource> = {
  CHOOSE: 'choose',
  MANUAL: 'manual',
};
