import type { Database } from '../index';
import { ensureSingleOrNone, matchIdIsh } from './util';
import { logger } from '../../logger';

export const loadWorkspace = (db: Database, identifier: string) => {
    logger.trace(
        'Load workspace with identifier `%s` from data store',
        identifier,
    );
    const items = db.Workspace.filter(workspace => (
      matchIdIsh(workspace, identifier) || workspace.name === identifier
    ));
    logger.trace('Found %d.', items.length);
    return ensureSingleOrNone(items, 'workspace');
};
