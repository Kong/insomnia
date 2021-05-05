// eslint-disable-next-line filenames/match-exported
const git = jest.requireActual('isomorphic-git');
const mock = jest.genMockFromModule('isomorphic-git');
// @ts-expect-error -- TSCONVERSION
git.push = mock.push;
// @ts-expect-error -- TSCONVERSION
git.clone = mock.clone;
module.exports = git;
