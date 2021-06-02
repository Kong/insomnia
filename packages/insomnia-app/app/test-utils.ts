import { showAlert, showError, showModal, showPrompt } from './ui/components/modals';

export const getAndClearShowPromptMockArgs = () => {
  const mockFn = showPrompt as jest.Mock<typeof showPrompt, Parameters<typeof showPrompt>>;
  const options = mockFn.mock.calls[0][0];
  mockFn.mockClear();
  return options;
};

export const getAndClearShowAlertMockArgs = () => {
  const mockFn = showAlert as jest.Mock<typeof showAlert, Parameters<typeof showAlert>>;
  const { title, okLabel, addCancel, message, onConfirm } = mockFn.mock.calls[0][0];
  mockFn.mockClear();
  return {
    title,
    okLabel,
    addCancel,
    message,
    onConfirm,
  };
};

export const getAndClearShowErrorMockArgs = () => {
  const mockFn = showError as jest.Mock<typeof showError, Parameters<typeof showError>>;
  const options = mockFn.mock.calls[0][0];
  mockFn.mockClear();
  return options;
};

export const getAndClearShowModalMockArgs = () => {
  const mockFn = showModal as jest.Mock<typeof showModal, Parameters<typeof showModal>>;
  const args = mockFn.mock.calls[0][1];
  mockFn.mockClear();
  return args;
};
