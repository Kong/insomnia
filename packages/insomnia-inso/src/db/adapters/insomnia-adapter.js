// @flow
import fs from 'fs';
import { emptyDb } from '../index';
import type { Database, DbAdapter } from '../index';
import type { BaseModel } from '../models/types';
import YAML from 'yaml';

const modelTypeToExportTypeMap = {
  ApiSpec: 'api_spec',
  Environment: 'environment',
  Request: 'request',
  RequestGroup: 'request_group',
  Workspace: 'workspace',
  UnitTestSuite: 'unit_test_suite',
  UnitTest: 'unit_test',
};

const insomniaAdapter: DbAdapter = async (path, filterTypes) => {
  // Sanity check - do db files exist and is it a file?
  if (!fs.existsSync(path) || fs.lstatSync(path).isDirectory()) return null;
  // Building an empty database
  const db: Database = emptyDb();

  // Now, reading and parsing
  const content = await fs.promises.readFile(path, { encoding: 'utf-8' });
  const object = YAML.parse(content);
  // We are supporting only v4 files
  if (object.__export_format !== 4) return null;
  const raw = object?.resources;

  // Filter data on type
  const types = filterTypes?.length ? filterTypes : Object.keys(db);

  if (raw?.length !== 0) {
    types.forEach(type => db[type].push(...read(raw, modelTypeToExportTypeMap[type])));
  }

  return db;
};

const read: Array<BaseModel> = (raw, _type) => {
  // Extract fields of the same types
  const extracted = extract(raw, _type);
  // Renaming from ._type to .type
  const renamed = rename(extracted, _type);
  // Now replacing with the correct type
  return replace(renamed, _type);
};

const replace: Array<BaseModel> = (raw: Array<BaseModel>, _type: string) => {
  return raw.map(item => {
    item.type = modelTypeToExportTypeMap[item.type];
    return item;
  });
};

const rename: BaseModel = arr => {
  return arr.map(obj => {
    obj.type = obj._type;
    delete obj._type;
    return obj;
  });
};

const extract: Array<BaseModel> = (raw, _type) => {
  return raw.filter(item => item?._type === _type);
};

export default insomniaAdapter;
