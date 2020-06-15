import * as db from '../commands/git-nedb';

export function globalBeforeEach() {
  // Setup the local database in case it's used
  db.init(db.SUPPORTED_TYPES, true);
}
