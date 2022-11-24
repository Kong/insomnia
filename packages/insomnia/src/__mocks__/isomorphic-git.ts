import isomorphicGitOriginal from 'isomorphic-git';
import { vi } from 'vitest';

// eslint-disable-next-line filenames/match-exported
const git = vi.requireActual('isomorphic-git') as typeof isomorphicGitOriginal;
const mock = vi.createMockFromModule('isomorphic-git') as typeof isomorphicGitOriginal;

git.push = mock.push;
git.clone = mock.clone;

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = git;
