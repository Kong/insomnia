import { jest } from '@jest/globals';
import openapi2Kong from 'openapi-2-kong';

module.exports = {
  ...jest.requireActual('openapi-2-kong') as typeof openapi2Kong,
  generate: jest.fn(),
  generateFromString: jest.fn(),
};
