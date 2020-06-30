const mod = jest.requireActual('insomnia-testing');

module.exports = {
  ...mod,
  generate: jest.fn(),
  generateToFile: jest.fn(),
  runTests: jest.fn(),
  runTestsCli: jest.fn(),
};
