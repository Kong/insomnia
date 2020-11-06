module.exports = {
  sendUnary: jest.fn(),
  startClientStreaming: jest.fn(),
  startServerStreaming: jest.fn(),
  startBidiStreaming: jest.fn(),
  sendMessage: jest.fn(),
  commit: jest.fn(),
  cancel: jest.fn(),
  cancelMultiple: jest.fn(),
};
