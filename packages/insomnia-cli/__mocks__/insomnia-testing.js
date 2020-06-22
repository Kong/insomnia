const mod = jest.requireActual('insomnia-testing');

module.exports = {
  ...mod,
  generate: jest.fn(),
  runTests: jest.fn(),
};
