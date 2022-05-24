import { jest } from '@jest/globals';

module.exports = {
  start: jest.fn(),
  sendMessage: jest.fn(),
  commit: jest.fn(),
  cancel: jest.fn(),
  cancelMultiple: jest.fn(),
};
