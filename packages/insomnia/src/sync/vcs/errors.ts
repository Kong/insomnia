export class UserAbortResolveMergeConflictError extends Error {
  constructor(message = 'User aborted merge') {
    super(message);
  }

  name = 'UserAbortResolveMergeConflictError';
}

export const isUserAbortResolveMergeConflictError = (error: unknown): error is UserAbortResolveMergeConflictError =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  error.name === 'UserAbortResolveMergeConflictError';
