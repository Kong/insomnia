// @flow
import type { Database } from '../index';
import type { Workspace } from './types';
import { ensureSingleOrNone, matchIdIsh } from './util';
import logger from '../../logger';

export const loadWorkspace = (db: Database, identifier: string): ?Workspace => {
  logger.trace('Load workspace with identifier `%s` from data store', identifier);
  const items = db.Workspace.filter(s => matchIdIsh(s, identifier) || s.name === identifier);
  logger.trace('Found %d.', items.length);

  return ensureSingleOrNone(items, 'workspace');
};
