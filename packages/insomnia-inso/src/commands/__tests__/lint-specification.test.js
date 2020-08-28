// @flow
import { lintSpecification } from '../lint-specification';
import { globalBeforeAll, globalBeforeEach } from '../../../__jest__/before';
import logger from '../../logger';

describe('lint specification', () => {
  beforeAll(() => {
    globalBeforeAll();
  });
  beforeEach(() => {
    globalBeforeEach();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return true for linting passed', async () => {
    const result = await lintSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      workingDir: 'src/db/__fixtures__/git-repo',
    });

    expect(result).toBe(true);
  });

  it('should return false for linting failed', async () => {
    const result = await lintSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      workingDir: 'src/db/__fixtures__/git-repo-malformed-spec',
    });

    expect(result).toBe(false);
  });

  it('should return false if spec could not be found', async () => {
    const result = await lintSpecification('not-found', {
      workingDir: 'src/db/__fixtures__/git-repo',
    });

    expect(result).toBe(false);
    const logs = logger.__getLogs();
    expect(logs.fatal).toContain('Specification not found.');
  });
});
