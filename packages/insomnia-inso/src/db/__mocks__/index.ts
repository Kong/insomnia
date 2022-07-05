import { jest } from '@jest/globals';

import * as dbOriginal from '../index';

// eslint-disable-next-line filenames/match-exported
const index = jest.requireActual('../index') as typeof dbOriginal;
const database = index.emptyDb();
index.loadDb = jest.fn().mockResolvedValue(database);
module.exports = index;
