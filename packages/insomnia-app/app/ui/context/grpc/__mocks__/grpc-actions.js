module.exports = {
  grpcActions: {
    reset: jest.fn(),
    clear: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    responseMessage: jest.fn(),
    requestMessage: jest.fn(),
    error: jest.fn(),
    status: jest.fn(),
    invalidate: jest.fn(),
    invalidateMany: jest.fn(),
    loadMethods: jest.fn(),
  },
};
