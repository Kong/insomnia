import { setDefaults } from './utils';
import { importers } from './importers';
import { ImportRequest } from './entities';

export interface RootConverter {
  type: {
    id: string;
    name: string;
    description: string;
  };
  data: {
    _type: 'export';
    __export_format: 4;
    __export_date: string;
    __export_source: `insomnia.importers:v${string}`;
    resources: ImportRequest;
  };
}

export const convert = async (rawData: string) => {
  for (const importer of importers) {
    const resources = await importer.convert(rawData);

    if (!resources) {
      continue;
    }

    if (resources.length > 0 && resources[0].variable) {
      resources[0].environment = resources[0].variable;
    }

    return {
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
        resources: resources.map(setDefaults),
      },
    };
  }

  throw new Error('No importers found for file');
};
