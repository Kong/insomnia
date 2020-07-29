// @flow
import type { Database } from '../index';
import type { Workspace } from './types';
import { MultipleFoundError, mustFindSingleOrNone, NoneFoundError } from '../index';
import { matchIdIsh } from './util';
import consola from 'consola';

export const loadWorkspace = (db: Database, identifier: string): ?Workspace => {
  consola.trace('Trying to load workspace with identifier %s', identifier);
  const [workspace, err] = mustFindSingleOrNone(
    db.Workspace,
    s => matchIdIsh(s, identifier) || s.name === identifier,
  );

  if (err) {
    if (err instanceof MultipleFoundError) {
      consola.warn('Multiple workspaces found; expected one.');
      return null;
    }

    if (err instanceof NoneFoundError) {
      consola.warn('No workspace found; expected one.');
      return null;
    }

    throw err;
  }
  return workspace;
};
