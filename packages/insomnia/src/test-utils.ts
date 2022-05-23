import { Mock } from 'jest-mock';

import { showAlert, showError, showModal, showPrompt } from './ui/components/modals';

export const getAndClearShowPromptMockArgs = () => {
  const mockFn = showPrompt as Mock<typeof showPrompt>;
  const options = mockFn.mock.calls[0][0];
  mockFn.mockClear();
  return options;
};

export const getAndClearShowAlertMockArgs = () => {
  const mockFn = showAlert as Mock<typeof showAlert>;
  const options = mockFn.mock.calls[0][0];
  mockFn.mockClear();
  return options;
};

export const getAndClearShowErrorMockArgs = () => {
  const mockFn = showError as Mock<typeof showError>;
  const options = mockFn.mock.calls[0][0];
  mockFn.mockClear();
  return options;
};

export const getAndClearShowModalMockArgs = () => {
  const mockFn = showModal as Mock<typeof showModal>;
  const args = mockFn.mock.calls[0][1];
  mockFn.mockClear();
  return args;
};
