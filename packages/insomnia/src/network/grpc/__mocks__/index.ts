import { vi } from 'vitest';

module.exports = {
  start: vi.fn(),
  sendMessage: vi.fn(),
  commit: vi.fn(),
  cancel: vi.fn(),
  cancelMultiple: vi.fn(),
};
