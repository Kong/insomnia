import * as fetch from '../account/fetch';
import { clearChangeListeners, setDatabase } from '../common/database';
import { resetDatabase } from '../main/database';
import { database } from '../main/database';
import * as models from '../models';

setDatabase(database);

export async function globalBeforeEach() {
  // Setup the local database in case it's used
  fetch.setup('insomnia-tests', 'http://localhost:8000');

  resetDatabase();
  clearChangeListeners();
  setDatabase(database);
  await database.init(
    models.types(),
    {
      inMemoryOnly: true,
    },
    () => {},
  );
}
