// @flow
export const noConsoleLog = async <T>(func: () => Promise<T>): Promise<T> => {
  const oldConsoleLog = console.log;
  (console: Object).log = () => {};

  try {
    return await func();
  } finally {
    (console: Object).log = oldConsoleLog;
  }
};
