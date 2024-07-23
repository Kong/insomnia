import { jest } from '@jest/globals';

export const cosmiconfigSync = () => ({
  load: jest.fn(),
  search: jest.fn(),
});
