import { vi } from 'vitest';

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = {
  grpcActions: {
    reset: vi.fn(),
    clear: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    responseMessage: vi.fn(),
    requestStream: vi.fn(),
    error: vi.fn(),
    status: vi.fn(),
    invalidate: vi.fn(),
    invalidateMany: vi.fn(),
    loadMethods: vi.fn(),
  },
};
