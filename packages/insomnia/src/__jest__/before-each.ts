import * as fetch from '../account/fetch';
import { database as db } from '../common/database';
import { DatabaseHost } from '../main/database';
import * as models from '../models';

export let hostDB: DatabaseHost;

export async function globalBeforeEach() {
  // Setup the local database in case it's used
  fetch.setup('insomnia-tests', 'http://localhost:8000');

  db.clearListeners();
  hostDB = await DatabaseHost.init(
    models.types(),
    {
      inMemoryOnly: true,
    },
    () => {},
  );
}
