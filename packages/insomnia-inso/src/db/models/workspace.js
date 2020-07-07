// @flow
import type { Database } from '../index';
import type { Workspace } from './types';
import { mustFindSingleOrNone } from '../index';
import { matchIdIsh } from './util';

export const loadWorkspace = (db: Database, identifier: string): ?Workspace =>
  mustFindSingleOrNone(db.Workspace, s => matchIdIsh(s, identifier) || s.name === identifier);
