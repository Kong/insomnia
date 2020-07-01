// @flow
import { lintSpecification } from '../lint-specification';

describe('lint specification', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return true for linting passed', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await lintSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      workingDir: 'src/db/__fixtures__/git-repo',
    });

    expect(result).toBe(true);
  });

  it('should return false for linting failed', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await lintSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      workingDir: 'src/db/__fixtures__/git-repo-malformed-spec',
    });

    expect(result).toBe(false);
  });
});
