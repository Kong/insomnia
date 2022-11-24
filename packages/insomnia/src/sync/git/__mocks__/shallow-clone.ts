import { vi } from 'vitest';

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = {
  shallowClone: vi.fn(),
};
