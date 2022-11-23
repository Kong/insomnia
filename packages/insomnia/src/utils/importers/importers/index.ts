import { Importer } from '../entities';
import * as curl from './curl';
import * as har from './har';
import * as insomnia1 from './insomnia-1';
import * as insomnia2 from './insomnia-2';
import * as insomnia3 from './insomnia-3';
import * as insomnia4 from './insomnia-4';
import * as openapi3 from './openapi-3';
import * as postman from './postman';
import * as postmanenv from './postman-env';
import * as swagger2 from './swagger-2';
import * as wsdl from './wsdl';

// note that the importers are tried one at a time until one works (for every given input).  That means that we would benefit from keeping the less computationally intense importers near the bottom of the list and the more computationally intense ones near the top.
export const importers: Importer[] = [
  insomnia1,
  insomnia2,
  insomnia3,
  insomnia4,
  postman,
  postmanenv,
  har,
  curl,
  swagger2,
  openapi3,
  wsdl,
];

export type { Insomnia1Data } from './insomnia-1';
export type { Insomnia2Data } from './insomnia-2';
export type { Insomnia3Data } from './insomnia-3';
export type { Insomnia4Data } from './insomnia-4';
