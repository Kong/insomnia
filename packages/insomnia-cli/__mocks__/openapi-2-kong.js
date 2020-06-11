const mod = jest.requireActual('openapi-2-kong');

module.exports = {
  ...mod,
  generate: jest.fn(),
  generateFromString: jest.fn(),
};
