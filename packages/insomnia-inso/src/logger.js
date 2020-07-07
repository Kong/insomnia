let oldConsoleLog = null;

export const enableLogger = () => {
  if (oldConsoleLog) {
    console.log = oldConsoleLog;
  }
};

export const disableLogger = () => {
  oldConsoleLog = console.log;
  console.log = () => {};
};
