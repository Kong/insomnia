import { jest } from '@jest/globals';

import * as utilOriginal from '../util';

// eslint-disable-next-line filenames/match-exported
const util = jest.requireActual('../util') as typeof utilOriginal;
util.exit = jest.fn();

module.exports = util;
