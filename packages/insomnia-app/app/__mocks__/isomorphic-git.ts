// eslint-disable-next-line filenames/match-exported
const git = jest.requireActual('isomorphic-git');
const mock = jest.genMockFromModule('isomorphic-git');

// @ts-expect-error -- TSCONVERSION
git.push = mock.push;

// @ts-expect-error -- TSCONVERSION
git.clone = mock.clone;

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = git;
