// @ts-expect-error TSMIGRATION
jasmine.getEnv().addReporter({
// @ts-expect-error TSMIGRATION
  specStarted: result => (jasmine.currentTest = result),
  // @ts-expect-error TSMIGRATION
  specDone: result => (jasmine.currentTest = result),
});
