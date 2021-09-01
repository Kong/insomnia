import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

import { InsoError } from '../../errors';
import { UNKNOWN } from '../../types';
import { DbAdapter } from '../index';
import { emptyDb } from '../index';
import { BaseModel } from '../models/types';

/**
 * When exporting from Insomnia, the `models.[kind].type` is converted from PascalCase to snake_case.
 *
 * It is then set to the property `_type`, and the `type` property is removed.
 * Therefore, when importing, we just need to do the reverse of this.
 *
 * e.g Exporting:
 * <pre>
 * delete models.unitTest.type; // is `UnitTest`
 * models.unitTest._type = 'unit_test';
 * </pre>
 *
 * e.g Importing:
 * <pre>
 * delete models.unitTest._type; // is `unit_test`
 * models.unitTest.type = 'UnitTest';
 * </pre>
 *
 * @see packages/insomnia-app/app/common/import.js
 */

type RawTypeKey = 'api_spec'
  | 'environment'
  | 'request'
  | 'request_group'
  | 'workspace'
  | 'unit_test_suite'
  | 'unit_test';

/* eslint-disable camelcase */
const rawTypeToParsedTypeMap: Record<RawTypeKey, BaseModel['type']> = {
  api_spec: 'ApiSpec',
  environment: 'Environment',
  request: 'Request',
  request_group: 'RequestGroup',
  workspace: 'Workspace',
  unit_test_suite: 'UnitTestSuite',
  unit_test: 'UnitTest',
};
/* eslint-enable camelcase */

type ExtraProperties = Record<string, unknown>;

type RawTypeModel = {
  _type: RawTypeKey;
} & ExtraProperties;

type ParsedTypeModel = Pick<BaseModel, 'type'> & ExtraProperties;

const parseRawType = (type: RawTypeModel['_type']): ParsedTypeModel['type'] => rawTypeToParsedTypeMap[type];

const parseRaw = ({ _type, ...rest }: RawTypeModel): ParsedTypeModel => ({
  ...rest,
  type: parseRawType(_type),
});

const insomniaAdapter: DbAdapter = async (filePath, filterTypes) => {
  // Sanity check - do db files exist and is it a file?
  const existsAndIsFile = fs.existsSync(filePath) && fs.lstatSync(filePath).isFile();

  if (!existsAndIsFile) {
    return null;
  }

  const fileName = path.basename(filePath);

  // Init an empty database
  const db = emptyDb();

  // Now, reading and parsing
  const content = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
  let parsed: {
    __export_format: number;
    resources: RawTypeModel[];
  } | undefined;
  try {
    parsed = YAML.parse(content);
  } catch (e) {
    throw new InsoError(`Failed to parse ${fileName}.`, e);
  }

  // We are supporting only v4 files
  if (!parsed) {
    throw new InsoError(`Failed to parse ${fileName}.`);
  } else if (!parsed.__export_format) {
    throw new InsoError(`Expected an Insomnia v4 export file; unexpected data found in ${fileName}.`);
  } else if (parsed.__export_format !== 4) {
    throw new InsoError(`Expected an Insomnia v4 export file; found an Insomnia v${parsed.__export_format} export file in ${fileName}.`);
  }

  // Transform filter to a set for faster search
  // If it is undefined, it will return an empty set
  const toFilter = new Set<string>(filterTypes);

  // Execute translation between raw and imported models
  parsed.resources.forEach(model => {
    // If there is no filter to apply, or this model is included in the filter
    if (!toFilter.size || toFilter.has(parseRawType(model._type))) {
      // Rename field, transform value and return a new object
      const obj = parseRaw(model);

      // Store it, only if the key value exists
      (db[obj.type] as UNKNOWN[])?.push(obj);
    }
  });

  return db;
};

export default insomniaAdapter;
