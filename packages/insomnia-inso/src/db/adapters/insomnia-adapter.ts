import fs from 'fs';
import type { Database, DbAdapter } from '../index';
import YAML from 'yaml';
import { emptyDb } from '../index';
import { BaseModel } from '../models/types';
import { UNKNOWN } from '../../types';

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

/* eslint-disable camelcase */
const modelTypeToExportTypeMap: Record<string, keyof Database> = {
  api_spec: 'ApiSpec',
  environment: 'Environment',
  request: 'Request',
  request_group: 'RequestGroup',
  workspace: 'Workspace',
  unit_test_suite: 'UnitTestSuite',
  unit_test: 'UnitTest',
};
/* eslint-enable camelcase */

export interface RawBaseModel {
  _id: string;
  _type: string;
  parentId: string;
}

const transformRawToImported = (item: RawBaseModel): BaseModel => ({
  _id: item._id,
  parentId: item.parentId,
  type: modelTypeToExportTypeMap[item._type],
});

const insomniaAdapter: DbAdapter = async (path, filterTypes) => {
  // Sanity check - do db files exist and is it a file?
  const existsAndIsFile = fs.existsSync(path) && fs.lstatSync(path).isFile();
  if (!existsAndIsFile) {
    return null;
  }

  // Init an empty database
  const db = emptyDb();

  // Now, reading and parsing
  const content = await fs.promises.readFile(path, { encoding: 'utf-8' });
  const parsed = YAML.parse(content);

  // We are supporting only v4 files
  if (parsed.__export_format !== 4) {
    return null;
  }

  // Read resources field which should contains all available objects
  const importedModels = parsed.resources;

  // Transform to set for faster comparison
  // If it is undefined, it will return an empty set
  const toFilter = new Set<string>(filterTypes);

  // Execute translation between un-mapped and mapped models
  importedModels.forEach((item: RawBaseModel) => {
    // If there is no filter to apply, or this model is included in the filter
    if (!toFilter.size || toFilter.has(modelTypeToExportTypeMap[item._type])) {
      // Rename field, transform value and return a new object
      const obj = transformRawToImported(item);
      // Store it, only if the key value exists
      (db[obj.type] as UNKNOWN[])?.push(obj);
    }
  });

  return db;
};

export default insomniaAdapter;
