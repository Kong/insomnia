// eslint-disable-next-line filenames/match-exported
const git = jest.requireActual('isomorphic-git');
const mock = jest.genMockFromModule('isomorphic-git');

git.push = mock.push;
module.exports = git;
