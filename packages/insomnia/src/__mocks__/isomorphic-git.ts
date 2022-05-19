import { jest } from '@jest/globals';
import isomorphicGitOriginal from 'isomorphic-git';

// eslint-disable-next-line filenames/match-exported
const git = jest.requireActual('isomorphic-git') as typeof isomorphicGitOriginal;
const mock = jest.createMockFromModule('isomorphic-git') as typeof isomorphicGitOriginal;

git.push = mock.push;
git.clone = mock.clone;

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = git;
