import { validate } from 'uuid';
import { describe, expect, it } from 'vitest';

import { Environment, Variables } from '../environments';
import { Folder, ParentFolders } from '../folders';

describe('test Variables object', () => {
    it('test basic operations', () => {
        const variables = new Variables({
            globalVars: new Environment('globals', { value: '777' }),
            environmentVars: new Environment('environments', {}),
            collectionVars: new Environment('baseEnvironment', {}),
            iterationDataVars: new Environment('iterationData', {}),
            folderLevelVars: [],
            localVars: new Environment('local', {}),
        });

        const uuidAnd777 = variables.replaceIn('{{    $randomUUID }}{{value  }}');
        expect(validate(uuidAnd777.replace('777', ''))).toBeTruthy();

        const uuidAndBrackets1 = variables.replaceIn('{{    $randomUUID }}}}');
        expect(validate(uuidAndBrackets1.replace('}}', ''))).toBeTruthy();

        const uuidAndBrackets2 = variables.replaceIn('}}{{    $randomUUID }}');
        expect(validate(uuidAndBrackets2.replace('}}', ''))).toBeTruthy();
    });

    it('test environment overriding', () => {
        const globalOnlyVariables = new Variables({
            globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
            environmentVars: new Environment('environments', {}),
            collectionVars: new Environment('baseEnvironment', {}),
            iterationDataVars: new Environment('iterationData', {}),
            folderLevelVars: [],
            localVars: new Environment('local', {}),
        });
        const normalVariables = new Variables({
            globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
            environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
            collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
            iterationDataVars: new Environment('iterationData', {}),
            folderLevelVars: [],
            localVars: new Environment('local', {}),
        });
        const variablesWithIterationData = new Variables({
            globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
            environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
            collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
            iterationDataVars: new Environment('iterationData', { scope: 'iterationData', value: 'iterationData-value' }),
            folderLevelVars: [],
            localVars: new Environment('local', {}),
        });
        const variablesWithFolderLevelData = new Variables({
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
            globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
            environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
            collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
            iterationDataVars: new Environment('iterationData', { scope: 'iterationData', value: 'iterationData-value' }),
            folderLevelVars: [],
            localVars: new Environment('local', { scope: 'local', value: 'local-value' }),
        });

        expect(globalOnlyVariables.get('value')).toEqual('global-value');
        expect(normalVariables.get('value')).toEqual('subEnv-value');
        expect(variablesWithIterationData.get('value')).toEqual('iterationData-value');
        expect(variablesWithFolderLevelData.get('value')).toEqual('folderLevel2-value');
        expect(variablesWithLocalData.get('value')).toEqual('local-value');

        expect(variablesWithFolderLevelData.replaceIn('{{ value}}')).toEqual('folderLevel2-value');
    });

    it('variables operations', () => {
        const folders = new ParentFolders([
            new Folder(
                '1',
                'folder1',
                { value: 'folder1Value' },
            ),
            new Folder(
                '2',
                'folder2',
                { value: 'folder2Value' },
            ),
        ]);

        const variables = new Variables({
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
