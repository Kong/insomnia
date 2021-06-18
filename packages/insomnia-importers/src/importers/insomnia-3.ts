import { Converter } from '../entities';
import { Insomnia2Data } from './insomnia-2';

export const id = 'insomnia-3';
export const name = 'Insomnia v3';
export const description = 'Insomnia export format 3';

export interface Insomnia3Data extends Omit<Insomnia2Data, '__export_format'> {
  __export_format: 3;
}

export const convert: Converter = (rawData) => {
  let data: Insomnia3Data | null = null;

  try {
    data = JSON.parse(rawData) as Insomnia3Data;
  } catch (e) {
    return null;
  }

  if (data.__export_format !== 3) {
    // Bail early if it's not the legacy format
    return null;
  }

  // This is the target export format so nothing needs to change
  return data.resources;
};
