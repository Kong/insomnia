// @flow
import fs from 'fs';
import type { DbAdapter } from '../index';
import YAML from 'yaml';
import { emptyDb } from '../index';

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
  const object = YAML.parse(content);
  // We are supporting only v4 files
  if (object.__export_format !== 4) return null;
  // Read resources field which should contains all available objects
  const importedModels = object?.resources;
  // Check if we have to filter
  const restricted = filterTypes && filterTypes?.length !== 0;
  // Execute translation between un-mapped and mapped models
  importedModels.forEach(item => {
    // Rename field, transform value and delete obsolete one
    item.type = modelTypeToExportTypeMap[item._type];
    delete item._type;
    // Filtering
    if (restricted) {
      db[item.type] && filterTypes.includes(item.type) && db[item.type].push(item);
    } else {
      db[item.type] && db[item.type].push(item);
    }
  });

  return db;
};

export default insomniaAdapter;
