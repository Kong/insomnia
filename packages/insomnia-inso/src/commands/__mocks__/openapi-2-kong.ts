module.exports = {
  ...jest.requireActual('openapi-2-kong'),
  generate: jest.fn(),
  generateFromString: jest.fn(),
};
