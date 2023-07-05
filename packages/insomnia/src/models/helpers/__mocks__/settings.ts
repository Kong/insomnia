import { jest } from '@jest/globals';

import * as settingsOriginal from '../settings';

const actual = jest.requireActual('../settings') as typeof settingsOriginal;

module.exports = actual;
