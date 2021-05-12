import { Converter, ImportRequest } from '../entities';
import { Insomnia1Data } from './insomnia-1';

export const id = 'insomnia-2';
export const name = 'Insomnia v2';
export const description = 'Insomnia export format 2';

export interface Insomnia2Data extends Omit<Insomnia1Data, '__export_format'> {
  __export_format: 2;
  resources: ImportRequest[];
}

export const convert: Converter = (rawData) => {
  let data: Insomnia2Data | null = null;

  try {
    data = JSON.parse(rawData) as Insomnia2Data;
  } catch (e) {
    return null;
  }

  if (data.__export_format !== 2) {
    // Exit early if it's not the legacy format
    return null;
  }

  // The only difference between 2 and 3 is the request body object
  for (const resource of data.resources) {
    if (resource._type !== 'request') {
      continue;
    }

    // Convert old String request bodies to new (HAR) schema
    const contentTypeHeader = resource.headers?.find(
      ({ name }) => name.toLowerCase() === 'content-type',
    );

    const mimeType = contentTypeHeader?.value.split(';')[0] ?? '';
    resource.body = {
      mimeType,
      text: resource.body as string,
    };
  }

  return data.resources;
};
