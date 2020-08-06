// eslint-disable-next-line filenames/match-exported
const mod = jest.requireActual('../util');

mod.exit = jest.fn();

module.exports = mod;
