import { describe, expect, it, jest } from '@jest/globals';
import path from 'path';

import { getOptions, loadCosmiConfig } from './get-options';

jest.unmock('cosmiconfig');

const fixturesDir = path.join('src', 'fixtures');

describe('loadCosmiConfig()', () => {
  it('should load .insorc.yaml config file in fixtures dir', () => {
    const result = loadCosmiConfig(path.join(fixturesDir, '.insorc.yaml'));
    expect(result).toEqual({
      __configFile: {
        options: {
          appDataDir: 'configFile',
          workingDir: 'workingDir',
          ci: true,
        },
        scripts: {
          lint: 'inso lint spec',
        },
        filePath: path.resolve(fixturesDir, '.insorc.yaml'),
      },
    });
  });

  it('should return empty object and report error if specified config file not found', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const result = loadCosmiConfig('not-found.yaml');
    expect(result).toEqual({});
    expect(consoleLogSpy).toHaveBeenCalledWith('Could not find config file at not-found.yaml.');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should return empty object if config file is blank', () => {
    const result = loadCosmiConfig(path.join(fixturesDir, '.insorc-blank.yaml'));
    expect(result).toEqual({});
  });

  it('should return blank properties and ignore extra items if settings and scripts not found in file', () => {
    const result = loadCosmiConfig(path.join(fixturesDir, '.insorc-missing-properties.yaml'));
    expect(result).toEqual({
      __configFile: {
        options: {},
        scripts: {},
        filePath: path.resolve(fixturesDir, '.insorc-missing-properties.yaml'),
      },
    });
  });
});

describe('getOptions', () => {

  it('should combine config file options with default options, favouring config file', () => {
    const defaultOptions = {
      appDataDir: 'default',
      anotherDefault: '0',
      config: path.join(fixturesDir, '.insorc.yaml'),
    };
    const result = getOptions(defaultOptions);
    expect(result).toEqual({
      appDataDir: 'configFile',
      workingDir: 'workingDir',
      ci: true,
      anotherDefault: '0',
      config: path.join(fixturesDir, '.insorc.yaml'),
      __configFile: {
        options: {
          appDataDir: 'configFile',
          workingDir: 'workingDir',
          ci: true,
        },
        scripts: {
          lint: 'inso lint spec',
        },
        filePath: path.resolve(fixturesDir, '.insorc.yaml'),
      },
    });
  });

  it('should print error to console if config file not found', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const configFilePath = path.join(fixturesDir, '.insorc-not-found.yaml');
    // Will also load src/fixtures/.insorc.yaml

    const defaultOptions = {
      appDataDir: 'default',
      anotherDefault: '0',
      config: configFilePath,
    };
    const result = getOptions(defaultOptions);
    expect(result).toEqual({
      appDataDir: 'default',
      anotherDefault: '0',
      config: configFilePath,
    });
    expect(logSpy).toHaveBeenCalledWith(`Could not find config file at ${configFilePath}.`);
    expect(errSpy).toHaveBeenCalled();
  });
});
