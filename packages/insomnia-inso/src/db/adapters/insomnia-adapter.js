// @flow
import fs from 'fs';
import { emptyDb } from '../index';
import type { Database, DbAdapter } from '../index';
import type { ApiSpec } from '../models/types';

const insomniaAdapter: DbAdapter = async path => {
  // Sanity check - do db files exist?
  if (!fs.existsSync(path)) return null;
  // Building an empty database
  const db: Database = emptyDb();

  // Now, reading and parsing
  const contents = await fs.promises.readFile(path);
  const object = JSON.parse(contents);
  // We are supporting only v4 files
  if (object.__export_format !== 4) return null;
  const raw = object?.resources;

  if (raw?.length !== 0) {
    db.ApiSpec.push(...extract(raw, 'api_spec'));
    db.Environment.push(...extract(raw, 'environment'));
    db.Request.push(...extract(raw, 'request'));
    db.RequestGroup.push(...extract(raw, 'request_group'));
    db.Workspace.push(...extract(raw, 'workspace'));
    db.UnitTestSuite.push(...extract(raw, 'unit_test_suite'));
    db.UnitTest.push(...extract(raw, 'unit_test'));
  }

  return db;
};

const extract: Array<ApiSpec> = (raw, _type) => {
  return raw.filter(e => e?._type === _type);
};

export default insomniaAdapter;
