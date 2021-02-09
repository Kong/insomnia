// @flow
import fs from 'fs';
import { emptyDb } from '../index';
import type { Database, DbAdapter } from '../index';
import type { BaseModel } from '../models/types';
import YAML from 'yaml';

const keyToType = {
  api_spec: 'ApiSpec',
  environment: 'Environment',
  request: 'Request',
  request_group: 'RequestGroup',
  workspace: 'Workspace',
  unit_test_suite: 'UnitTestSuite',
  unit_test: 'UnitTest',
};

const insomniaAdapter: DbAdapter = async path => {
  // Sanity check - do db files exist?
  if (!fs.existsSync(path)) return null;
  // Building an empty database
  const db: Database = emptyDb();

  // Now, reading and parsing
  const content = await fs.promises.readFile(path, { encoding: 'utf-8' });
  const object = YAML.parse(content);
  // We are supporting only v4 files
  if (object.__export_format !== 4) return null;
  const raw = object?.resources;

  if (raw?.length !== 0) {
    db.ApiSpec.push(...read(raw, 'api_spec'));
    db.Environment.push(...read(raw, 'environment'));
    db.Request.push(...read(raw, 'request'));
    db.RequestGroup.push(...read(raw, 'request_group'));
    db.Workspace.push(...read(raw, 'workspace'));
    db.UnitTestSuite.push(...read(raw, 'unit_test_suite'));
    db.UnitTest.push(...read(raw, 'unit_test'));
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

const replace: Array<BaseModel> = (raw, _type) => {
  return raw.map(item => {
    item.type = keyToType[_type];
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
