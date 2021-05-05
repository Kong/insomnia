import * as modals from './ui/components/modals';
import type { ErrorModalOptions } from './ui/components/modals/error-modal';

export const getAndClearShowPromptMockArgs = () => {
  const mockFn = modals.showPrompt as JestMockFn;
  const { title, submitName, defaultValue, onComplete } = mockFn.mock.calls[0][0];
  mockFn.mockClear();
  return {
    title,
    submitName,
    defaultValue,
    onComplete,
  };
};

export const getAndClearShowAlertMockArgs = () => {
  const mockFn = modals.showAlert as JestMockFn;
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

export const getAndClearShowErrorMockArgs = (): ErrorModalOptions => {
  const mockFn = modals.showError as JestMockFn;
  const options: ErrorModalOptions = mockFn.mock.calls[0][0];
  mockFn.mockClear();
  return options;
};

export const getAndClearShowModalMockArgs = () => {
  const mockFn = modals.showModal as JestMockFn;
  const args = mockFn.mock.calls[0][1];
  mockFn.mockClear();
  return args;
};
