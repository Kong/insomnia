// @flow
export const noConsoleLog = async <T>(callback: () => Promise<T>): Promise<T> => {
  const oldConsoleLog = console.log;
  (console: Object).log = () => {};

  try {
    return await callback();
  } finally {
    (console: Object).log = oldConsoleLog;
  }
};
