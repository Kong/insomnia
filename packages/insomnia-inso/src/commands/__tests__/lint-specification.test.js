// @flow
import path from 'path';
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

  it('should lint specification from file with relative path', async () => {
    const result = await lintSpecification(
      '.insomnia/ApiSpec/spc_46c5a4a40e83445a9bd9d9758b86c16c.yml',
      {
        workingDir: 'src/db/__fixtures__/git-repo',
      },
    );

    expect(result).toBe(true);
  });

  it('should lint specification from file with relative path and no working directory', async () => {
    const result = await lintSpecification(
      'src/db/__fixtures__/git-repo/.insomnia/ApiSpec/spc_46c5a4a40e83445a9bd9d9758b86c16c.yml',
      {},
    );

    expect(result).toBe(true);
  });

  it('should lint specification from file with absolute path', async () => {
    const directory = path.join(process.cwd(), '/src/db/__fixtures__/git-repo/');
    const result = await lintSpecification(
      path.join(directory, '.insomnia/ApiSpec/spc_46c5a4a40e83445a9bd9d9758b86c16c.yml'),
      {
        workingDir: 'src/db/__fixtures__/git-repo',
      },
    );

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

  it('should return false if spec was not specified', async () => {
    const result = await lintSpecification('', {
      workingDir: 'src/db/__fixtures__/git-repo',
    });

    expect(result).toBe(false);
    const logs = logger.__getLogs();
    expect(logs.fatal).toContain('Invalid specification.');
  });
});
