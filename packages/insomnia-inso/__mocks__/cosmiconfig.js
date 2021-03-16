const mock = { load: jest.fn(), search: jest.fn() };

module.exports = {
  cosmiconfigSync: () => mock,
};
