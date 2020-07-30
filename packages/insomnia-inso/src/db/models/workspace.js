// @flow
import type { Database } from '../index';
import type { Workspace } from './types';
import { ensureSingleOrNone, matchIdIsh } from './util';
import consola from 'consola';

export const loadWorkspace = (db: Database, identifier: string): ?Workspace => {
  consola.trace('Load workspace with identifier %s', identifier);
  const items = db.Workspace.filter(s => matchIdIsh(s, identifier) || s.name === identifier);
  consola.trace('Found %d.', items.length);

  return ensureSingleOrNone(items, 'workspace');
};
