import YAML from 'yaml';
import { Converter } from '../entities';
import { Insomnia3Data } from './insomnia-3';

export const id = 'insomnia-4';
export const name = 'Insomnia v4';
export const description = 'Insomnia export format 4';

export interface Insomnia4Data extends Omit<Insomnia3Data, '__export_format'> {
  __export_format: 4;
}

export const convert: Converter = (rawData) => {
  let data;

  try {
    data = YAML.parse(rawData);
  } catch (e) {
    return null;
  }

  if (data.__export_format !== 4) {
    // Bail early if it's not the legacy format
    return null;
  } // This is the target export format so nothing needs to change

  return data.resources;
};
