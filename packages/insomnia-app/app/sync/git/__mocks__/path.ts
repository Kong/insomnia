// eslint-disable-next-line filenames/match-exported
const path = jest.requireActual('path');

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = {
  __mockPath: (type?: string) => {
    const mock = type === 'win32' ? path.win32 : path.posix;
    Object.keys(mock).forEach(k => (path[k] = mock[k]));
  },
  ...path,
};
