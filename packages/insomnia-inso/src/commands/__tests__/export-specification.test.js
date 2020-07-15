// @flow
import { exportSpecification } from '../export-specification';
import { writeFileWithCliOptions } from '../../write-file';

jest.mock('../../write-file');

describe('exportSpecification()', () => {
  // make flow happy
  const mock = (mockFn: any) => mockFn;
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should load identifier from database', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const result = await exportSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', {
      workingDir: 'src/db/__fixtures__/git-repo',
    });

    expect(result).toBe(true);
    expect(writeFileWithCliOptions).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("openapi: '3.0.2"));
  });

  it('should output document to a file', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const outputPath = 'this-is-the-output-path';
    mock(writeFileWithCliOptions).mockResolvedValue({ outputPath });

    const options = {
      output: 'output.yaml',
      workingDir: 'src/db/__fixtures__/git-repo',
    };

    const result = await exportSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', options);

    expect(result).toBe(true);

    expect(writeFileWithCliOptions).toHaveBeenCalledWith(
      options.output,
      expect.stringContaining("openapi: '3.0.2"),
      options.workingDir,
    );

    expect(consoleSpy).toHaveBeenCalledWith(`Specification exported to "${outputPath}".`);
  });

  it('should return false if writing file returns error', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const outputPath = 'this-is-the-output-path';
    const error = new Error('error message');
    mock(writeFileWithCliOptions).mockResolvedValue({ outputPath, error });

    const options = {
      output: 'output.yaml',
      workingDir: 'src/db/__fixtures__/git-repo',
    };

    const result = await exportSpecification('spc_46c5a4a40e83445a9bd9d9758b86c16c', options);

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(`Failed to write to "${outputPath}".\n`, error);
  });

  it('should return false if spec could not be found', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const result = await exportSpecification('not-found', {
      workingDir: 'src/db/__fixtures__/git-repo',
    });

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('Specification not found.');
  });
});
