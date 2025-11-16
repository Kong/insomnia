import { expect } from 'vitest';

export function setupDateMocks() {
  let ts = 1_000_000_000_000;

  class fakeDate extends Date {
    constructor(arg) {
      if (!arg) {
        return new Date(ts++);
      }
      super(arg);
    }

    getTimezoneOffset() {
      return 0;
    }

    static now() {
      return Date.now();
    }
  }

  globalThis.Date = fakeDate;
}

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
