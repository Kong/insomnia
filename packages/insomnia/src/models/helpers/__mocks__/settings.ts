const actual = jest.requireActual('../settings');

actual.getConfigSettings = jest.fn();

module.exports = actual;
