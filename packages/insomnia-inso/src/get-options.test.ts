import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import { tryToReadInsoConfigFile } from './cli';

vi.unmock('cosmiconfig');

const fixturesDir = path.join('src', 'fixtures');

describe('tryToReadInsoConfigFile()', () => {
  it('should load .insorc-test.yaml config file in fixtures dir', async () => {
    const result = await tryToReadInsoConfigFile(path.join(fixturesDir, '.insorc-test.yaml'));
    expect(result).toEqual({
      options: {
      },
      scripts: {
        exportSpec: 'inso export spec',
        lintSpec: 'inso lint spec',
      },
      filePath: path.resolve(fixturesDir, '.insorc-test.yaml'),
    });
    expect(result?.options?.shouldBeIgnored).toBe(undefined);
  });

  it('should return empty object and report error if specified config file not found', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const result = await tryToReadInsoConfigFile('not-found.yaml');
    expect(result).toEqual({});
    expect(consoleLogSpy).toHaveBeenCalledWith('Could not find config file at not-found.yaml.');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should return empty object if config file is blank', async () => {
    const result = await tryToReadInsoConfigFile(path.join(fixturesDir, '.insorc-blank.yaml'));
    expect(result).toEqual({});
  });

  it('should return blank properties and ignore extra items if settings and scripts not found in file', async () => {
    const result = await tryToReadInsoConfigFile(path.join(fixturesDir, '.insorc-missing-properties.yaml'));
    expect(result).toEqual({
      options: {},
      scripts: {},
      filePath: path.resolve(fixturesDir, '.insorc-missing-properties.yaml'),
    });
  });
});
