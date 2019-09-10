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
