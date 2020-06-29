import { send } from '../app/network/network';
import { init as initDb } from '../app/common/database';
import { types as modelTypes } from '../app/models';

initDb(modelTypes()).then(
  () => {},
  err => {
    console.log('Failed to initialize DB', err);
  },
);

export { send };
