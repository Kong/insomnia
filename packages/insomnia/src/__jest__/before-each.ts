import * as models from '@insomnia/models';

import * as fetch from '../account/fetch';
import { database as db } from '../common/database';

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
