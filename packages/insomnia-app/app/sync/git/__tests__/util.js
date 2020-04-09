export function setupDateMocks() {
  let ts = 1000000000000;

  class fakeDate extends Date {
    constructor(arg) {
      if (!arg) {
        return new Date(ts++);
      } else {
        super(arg);
      }
    }

    getTimezoneOffset() {
      return 0;
    }

    static now() {
      return new Date().getTime();
    }
  }

  global.Date = fakeDate;
}

export async function assertAsyncError(promise, code) {
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
