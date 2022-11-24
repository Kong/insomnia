import { vi } from 'vitest';

import * as modalsOriginal from '../index';

// eslint-disable-next-line filenames/match-exported
const modals = vi.requireActual('../index') as typeof modalsOriginal;

modals.showError = vi.fn();
modals.showAlert = vi.fn();
modals.showPrompt = vi.fn();
modals.showModal = vi.fn();

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = modals;
