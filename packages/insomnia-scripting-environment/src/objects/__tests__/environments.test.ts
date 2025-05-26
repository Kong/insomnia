import { validate } from 'uuid';
import { describe, expect, it } from 'vitest';

import { Environment, Variables } from '../environments';
import { Folder, ParentFolders } from '../folders';

describe('test Variables object', () => {
  it('test basic operations', () => {
    const variables = new Variables({
      baseGlobalVars: new Environment('baseGlobals', { value: 'baseValue' }),
      globalVars: new Environment('globals', { value: 'xyz' }),
      environmentVars: new Environment('environments', {}),
      collectionVars: new Environment('baseEnvironment', {}),
      iterationDataVars: new Environment('iterationData', {}),
      folderLevelVars: [],
      localVars: new Environment('local', {}),
    });

    const uuidAndXyz = variables.replaceIn('{{    $randomUUID }}{{value  }}');
    expect(validate(uuidAndXyz.replace('xyz', ''))).toBeTruthy();

    const uuidAndBrackets1 = variables.replaceIn('{{    $randomUUID }}}}');
    expect(validate(uuidAndBrackets1.replace('}}', ''))).toBeTruthy();

    const uuidAndBrackets2 = variables.replaceIn('}}{{    $randomUUID }}');
    expect(validate(uuidAndBrackets2.replace('}}', ''))).toBeTruthy();
  });

  it('test environment overriding', () => {
    const baseGlobalVariables = new Variables({
      baseGlobalVars: new Environment('baseGlobals', { scope: 'baseGlobals', value: 'baseGlobals-value' }),
      globalVars: new Environment('globals', {}),
      environmentVars: new Environment('environments', {}),
      collectionVars: new Environment('baseEnvironment', {}),
      iterationDataVars: new Environment('iterationData', {}),
      folderLevelVars: [],
      localVars: new Environment('local', {}),
    });
    const globalOnlyVariables = new Variables({
      baseGlobalVars: new Environment('baseGlobals', { scope: 'baseGlobals', value: 'baseGlobals-value' }),
      globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
      environmentVars: new Environment('environments', {}),
      collectionVars: new Environment('baseEnvironment', {}),
      iterationDataVars: new Environment('iterationData', {}),
      folderLevelVars: [],
      localVars: new Environment('local', {}),
    });
    const normalVariables = new Variables({
      baseGlobalVars: new Environment('baseGlobals', { scope: 'baseGlobals', value: 'baseGlobals-value' }),
      globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
      environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
      collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
      iterationDataVars: new Environment('iterationData', {}),
      folderLevelVars: [],
      localVars: new Environment('local', {}),
    });
    const variablesWithIterationData = new Variables({
      baseGlobalVars: new Environment('baseGlobals', { scope: 'baseGlobals', value: 'baseGlobals-value' }),
      globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
      environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
      collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
      iterationDataVars: new Environment('iterationData', { scope: 'iterationData', value: 'iterationData-value' }),
      folderLevelVars: [],
      localVars: new Environment('local', {}),
    });
    const variablesWithFolderLevelData = new Variables({
      baseGlobalVars: new Environment('baseGlobals', { scope: 'baseGlobals', value: 'baseGlobals-value' }),
      globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
      environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
      collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
      iterationDataVars: new Environment('iterationData', { scope: 'iterationData', value: 'iterationData-value' }),
      folderLevelVars: [
        new Environment('folderLevel1', { scope: 'folderLevel1', value: 'folderLevel1-value' }),
        new Environment('folderLevel2', { scope: 'folderLevel2', value: 'folderLevel2-value' }),
      ],
      localVars: new Environment('local', { scope: 'local' }),
    });
    const variablesWithLocalData = new Variables({
      baseGlobalVars: new Environment('baseGlobals', { scope: 'baseGlobals', value: 'baseGlobals-value' }),
      globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
      environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
      collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
      iterationDataVars: new Environment('iterationData', { scope: 'iterationData', value: 'iterationData-value' }),
      folderLevelVars: [],
      localVars: new Environment('local', { scope: 'local', value: 'local-value' }),
    });

    expect(baseGlobalVariables.get('value')).toEqual('baseGlobals-value');
    expect(globalOnlyVariables.get('value')).toEqual('global-value');
    expect(normalVariables.get('value')).toEqual('subEnv-value');
    expect(variablesWithIterationData.get('value')).toEqual('iterationData-value');
    expect(variablesWithFolderLevelData.get('value')).toEqual('folderLevel2-value');
    expect(variablesWithLocalData.get('value')).toEqual('local-value');

    expect(variablesWithFolderLevelData.replaceIn('{{ value}}')).toEqual('folderLevel2-value');
  });

  it('variables operations', () => {
    const folders = new ParentFolders([
      new Folder('1', 'folder1', { value: 'folder1Value' }),
      new Folder('2', 'folder2', { value: 'folder2Value' }),
    ]);

    const variables = new Variables({
      baseGlobalVars: new Environment('baseGlobals', { scope: 'baseEnv', value: 'baseGlobal-value' }),
      globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
      environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
      collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
      iterationDataVars: new Environment('iterationData', { scope: 'iterationData', value: 'iterationData-value' }),
      folderLevelVars: folders.getEnvironments(),
      localVars: new Environment('local', { scope: 'local' }),
    });

    folders.get('folder2').environment.set('value', 'folder1ValueOverride');
    expect(variables.get('value')).toEqual('folder1ValueOverride');
  });
});
