import { ipcRenderer } from 'electron';

const normalizeIpcError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }

  const cleanedMessage = error.message.replace(/^Error invoking remote method '[^']+': Error:\s*/, '');

  if (cleanedMessage === error.message) {
    return error;
  }

  const normalized = new Error(cleanedMessage);
  normalized.name = error.name;
  normalized.stack = error.stack;
  return normalized;
};

export const invokeWithNormalizedError = async <T>(channel: string, ...args: unknown[]) => {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T;
  } catch (error) {
    throw normalizeIpcError(error);
  }
};
