import { jest } from '@jest/globals';

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = {
  shallowClone: jest.fn(),
};
