// eslint-disable-next-line filenames/match-exported
const path = jest.requireActual('path');

const exportObj = { __mockPath, ...path };

function __mockPath(type) {
  const mock = type === 'win32' ? path.win32 : path.posix;

  Object.keys(mock).forEach(k => (exportObj[k] = mock[k]));
}

module.exports = exportObj;
