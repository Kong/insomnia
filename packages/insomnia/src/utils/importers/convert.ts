import { v4 as uuidv4 } from 'uuid';

import type { PostmanDataDumpRawData } from '../../common/import';
import type { ImportRequest } from './entities';
import { convert as postmanConvert } from './importers/postman';
import { convert as postmanEnvConvert } from './importers/postman-env';
import { setDefaults } from './utils';

export interface InsomniaImporter {
  id: string;
  name: string;
  description: string;
}

export interface ConvertResult {
  type: InsomniaImporter;
  data: {
    _type: 'export';
    __export_format: 4;
    __export_date: string;
    __export_source: `insomnia.importers:v${string}`;
    resources: ImportRequest[];
  };
}

function modifyResourcesAfterConvert(resources: ImportRequest[]): ImportRequest[] {
  dotInKeyNameInvariant(resources);
  // Each postman's collection has its variable, we map it to request group's environment in Insomnia
  // I think it's better to check if the resource's type is request_group rather than to check it by index 0, but let's just leave it as it is
  if (resources.length > 0 && resources[0].variable) {
    resources[0].environment = resources[0].variable;
  }
  return resources.map(setDefaults) as ImportRequest[];
}

export const convert = async (rawData: string) => {
  const importers = (await import('./importers')).importers;
  for (const importer of importers) {
    let resources = await importer.convert(rawData);

    if (!resources) {
      continue;
    }

    resources = modifyResourcesAfterConvert(resources as ImportRequest[]);

    const convertedResult = {
      type: {
        id: importer.id,
        name: importer.name,
        description: importer.description,
      },
      data: {
        _type: 'export',
        __export_format: 4,
        __export_date: new Date().toISOString(),
        __export_source: 'insomnia.importers:v0.1.0',
        resources: resources as ImportRequest[],
      },
    };

    return convertedResult;
  }

  throw new Error('No importers found for file');
};

export async function convertPostmanDataDump({
  collectionList,
  envList,
}: PostmanDataDumpRawData) {
  const resources: ImportRequest[] = [];
  collectionList.forEach(collectionRawStr => {
    const workspaceUuid = uuidv4();
    const result = postmanConvert(collectionRawStr, {
      meta: {
        workspaceUuid,
      },
    });
    if (result) {
      // here we add a workspace to hold the imported collection
      resources.push({
        name: (result as ImportRequest[]).find(({ _type, parentId }) => _type === 'request_group' && parentId === '__WORKSPACE_ID__')?.name || 'Imported Collection',
        parentId: null,
        scope: 'collection',
        _id: '__WORKSPACE_ID__',
        _type: 'workspace',
        workspaceUuid,
      });
      resources.push(
        ...(modifyResourcesAfterConvert(result as ImportRequest[]))
      );
    }
  });
  envList.forEach(envRawStr => {
    const result = postmanEnvConvert(envRawStr);
    result && resources.push(
      ...(modifyResourcesAfterConvert(result as ImportRequest[]))
    );
  });

  return {
    type: {
      id: 'postman-data-dump',
      name: 'Postman Data Dump',
      description: 'Importer for Postman data dump',
    },
    data: {
      _type: 'export',
      __export_format: 4,
      __export_date: new Date().toISOString(),
      __export_source: 'insomnia.importers:v0.1.0',
      resources,
    },
  };
}

// this checks invalid keys ahead, or nedb would return an error in importing.
export function dotInKeyNameInvariant(entity: object) {
  JSON.stringify(entity, (key, value) => {
    if (key.includes('.')) {
      throw new Error(`Detected invalid key "${key}", which contains '.'. Please update it in the original tool and re-import it.`);
    }

    return value;
  });
}
