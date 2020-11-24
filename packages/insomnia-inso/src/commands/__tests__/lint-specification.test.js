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
    const result = await lintSpecification('openapi-spec.yaml', {
      workingDir: 'src/commands/__fixtures__',
    });

    expect(result).toBe(true);
  });

  it('should lint specification from file with relative path and no working directory', async () => {
    const result = await lintSpecification('src/commands/__fixtures__/openapi-spec.yaml', {});

    expect(result).toBe(true);
  });

  it('should lint specification from file with absolute path', async () => {
    const directory = path.join(process.cwd(), 'src/commands/__fixtures__');
    const result = await lintSpecification(path.join(directory, 'openapi-spec.yaml'), {
      workingDir: 'src',
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
    const result = await lintSpecification('not-found', {});

    expect(result).toBe(false);
    const logs = logger.__getLogs();
    expect(logs.fatal).toContain('Failed to read "not-found"');
  });

  it('should return false if spec was not specified', async () => {
    const result = await lintSpecification('', {});

    expect(result).toBe(false);
    const logs = logger.__getLogs();
    expect(logs.fatal).toContain('Specification not found.');
  });
});
