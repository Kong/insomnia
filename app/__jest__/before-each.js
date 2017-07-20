import * as db from '../common/database';
import * as models from '../models';

export default function () {
  // Setup the local database in case it's used
  db.init(models.types(), {inMemoryOnly: true}, true);
}
