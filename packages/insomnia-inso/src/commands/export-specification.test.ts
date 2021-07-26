import { globalBeforeAll, globalBeforeEach } from '../jest/before';
import { logger } from '../logger';
import { writeFileWithCliOptions as _writeFileWithCliOptions } from '../write-file';
import { exportSpecification } from './export-specification';

jest.mock('../write-file');

const writeFileWithCliOptions = _writeFileWithCliOptions as jest.MockedFunction<typeof _writeFileWithCliOptions>;

describe('exportSpecification()', () => {
  beforeAll(() => {
    globalBeforeAll();
  });

  beforeEach(() => {
    globalBeforeEach();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should load identifier from database', async () => {
    const result = await exportSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      workingDir: 'src/db/fixtures/git-repo',
    });
    expect(result).toBe(true);
    expect(writeFileWithCliOptions).not.toHaveBeenCalled();
    expect(logger.__getLogs().log).toEqual([expect.stringContaining("openapi: '3.0.2")]);
  });

  it('should output document to a file', async () => {
    const outputPath = 'this-is-the-output-path';
    writeFileWithCliOptions.mockResolvedValue(outputPath);
    const options = {
      output: 'output.yaml',
      workingDir: 'src/db/fixtures/git-repo',
    };
    const result = await exportSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', options);
    expect(result).toBe(true);
    expect(writeFileWithCliOptions).toHaveBeenCalledWith(
      options.output,
      expect.stringContaining("openapi: '3.0.2"),
      options.workingDir,
    );
    expect(logger.__getLogs().log).toEqual([`Specification exported to "${outputPath}".`]);
  });

  it('should throw if writing file returns error', async () => {
    const error = new Error('error message');
    writeFileWithCliOptions.mockRejectedValue(error);
    const options = {
      output: 'output.yaml',
      workingDir: 'src/db/fixtures/git-repo',
    };
    await expect(
      exportSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', options),
    ).rejects.toThrowError(error);
  });

  it('should return false if spec could not be found', async () => {
    const result = await exportSpecification('not-found', {
      workingDir: 'src/db/fixtures/git-repo',
    });
    expect(result).toBe(false);
    expect(logger.__getLogs().fatal).toEqual(['Specification not found.']);
  });
});
