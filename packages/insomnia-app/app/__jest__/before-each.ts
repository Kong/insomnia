import * as fetch from '../account/fetch';
import { database as db } from '../common/database';
import * as models from '../models';

export async function globalBeforeEach() {
  // Setup the local database in case it's used
  fetch.setup('insomnia-tests', 'http://localhost:8000');
  await db.init(
    models.types(),
    {
      inMemoryOnly: true,
    },
    true,
    () => {},
  );
}
