declare namespace Mocha {
  interface TestFunction {
    // This is a hack until we can get rid of Mocha entirely from `insomnia-testing`.
    // Until then, both declare global types which will always conflict and we need to do something like this to backport compatability.
    each: jest.Each;
  }
}
