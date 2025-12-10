import nodePath from 'node:path';

import log from 'electron-log/main';

import { isDevelopment } from '../common/constants';

// It preloads electron-log IPC code in renderer processes
log.initialize();

export const initializeLogging = () => {
  if (isDevelopment()) {
    // Disable file logging during development
    log.transports.file.level = false;
  } else {
    const fileTransport = log.transports.file;
    // https://github.com/megahertz/electron-log/discussions/411
    // let log from renderer processes could be written to renderer.log
    fileTransport.resolvePathFn = (variables, msg) => {
      if (msg?.variables?.processType === 'renderer') {
        return nodePath.join(variables.libraryDefaultDir, 'renderer.log');
      }
      return nodePath.join(variables.libraryDefaultDir, variables.fileName || 'main.log');
    };
    const mainLogFile = fileTransport.getFile();
    const rendererLogFile = fileTransport.getFile({ variables: { processType: 'renderer' } });
    // Set the max log file size to 10mb
    // When the log file exceeds this limit, it will be rotated to {file name}.old.log file.
    fileTransport.maxSize = 1024 * 1024 * 10;
    // Rotate the log file every time we start the app
    fileTransport.archiveLogFn(mainLogFile);
    mainLogFile.clear();
    fileTransport.archiveLogFn(rendererLogFile);
    rendererLogFile.clear();
  }

  // Overwrite the console.log/warn/etc methods
  Object.assign(console, log.functions);
};

export function getLogDirectory() {
  const logPath = log.transports.file.getFile().path;
  return nodePath.dirname(logPath);
}

export default log;
