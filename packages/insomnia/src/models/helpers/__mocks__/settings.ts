import { vi } from 'vitest';

import * as settingsOriginal from '../settings';

const actual = vi.requireActual('../settings') as typeof settingsOriginal;

actual.getConfigSettings = vi.fn();

module.exports = actual;
