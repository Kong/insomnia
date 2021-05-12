
// @ts-expect-error -- TSCONVERSION
jasmine.getEnv().addReporter({
  // @ts-expect-error -- TSCONVERSION
  specStarted: result => (jasmine.currentTest = result),
  // @ts-expect-error -- TSCONVERSION
  specDone: result => (jasmine.currentTest = result),
});
