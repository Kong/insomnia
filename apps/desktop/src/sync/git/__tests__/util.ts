import { expect } from 'vitest';

export async function assertAsyncError(promise: Promise<any>, code?: string) {
  try {
    await promise;
  } catch (err) {
    if (code) {
      expect(err.message).toMatch(new RegExp(`^${code}.+`));
      expect(err.code).toBe(code);
    }

    return;
  }

  throw new Error('Promise did not throw');
}
