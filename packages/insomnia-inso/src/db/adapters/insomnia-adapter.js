// @flow
import fs from 'fs';
import type { DbAdapter } from '../index';
import YAML from 'yaml';
import { emptyDb } from '../index';

/**
 * When exporting, models.[kind].type is translated to his CamelCase corrispettive.
 *
 * It is then set to the property _type, and the type property is removed.
 * Therefore, when importing, we just need to do the reverse of this.
 *
 * e.g Exporting:
 * <pre>
 * delete models.unitTest.type;
 * models.unitTest._type = 'unit_test';
 * </pre>
 *
 * e.g Importing:
 * <pre>
 * delete models.unitTest._type;
 * models.unitTest.type = 'unitTest';
 * </pre>
 *
 * @see packages/insomnia-app/app/common/import.js
 */
const modelTypeToExportTypeMap = {
  api_spec: 'ApiSpec',
  environment: 'Environment',
  request: 'Request',
  request_group: 'RequestGroup',
  workspace: 'Workspace',
  unit_test_suite: 'UnitTestSuite',
  unit_test: 'UnitTest',
};

const insomniaAdapter: DbAdapter = async (path, filterTypes) => {
  // Sanity check - do db files exist and is it a file?
  if (!fs.existsSync(path) || fs.lstatSync(path).isDirectory()) return null;
  // Init Db var
  const db = emptyDb();
  // Now, reading and parsing
  const content = await fs.promises.readFile(path, { encoding: 'utf-8' });
  const parsed = YAML.parse(content);
  // We are supporting only v4 files
  if (parsed.__export_format !== 4) return null;
  // Read resources field which should contains all available objects
  const importedModels = parsed.resources;
  // Check if we have to filter
  const restricted = filterTypes && filterTypes.length !== 0;
  // Transform to set for faster comparison
  // If it is undefined, it will return an empty set
  filterTypes = new Set<string>(filterTypes);
  // Execute translation between un-mapped and mapped models
  importedModels.forEach(item => {
    // Do we need to filter?
    if (restricted) {
      // If so, is it an allowed type?
      if (filterTypes.has(modelTypeToExportTypeMap[item._type])) {
        // Rename field, transform value and delete obsolete one
        item.type = modelTypeToExportTypeMap[item._type];
        delete item._type;
        // Store it
        db[item.type] && db[item.type].push(item);
      }
    } else {
      // Rename field, transform value and delete obsolete one
      item.type = modelTypeToExportTypeMap[item._type];
      delete item._type;
      // Store it
      db[item.type] && db[item.type].push(item);
    }
  });

  return db;
};

export default insomniaAdapter;
