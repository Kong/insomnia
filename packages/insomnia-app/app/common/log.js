// @flow
import log from 'electron-log';
import { isDevelopment } from './constants';
import { dirname } from 'path';

export const initializeLogging = () => {
  if (isDevelopment()) {
    // Disable file logging during development
    log.transports.file.level = false;
  } else {
    const fileTransport = log.transports.file;
    const logFile = fileTransport.getFile();
    // Set the max log file size to 10mb
    // When the log file exceeds this limit, it will be rotated to {file name}.old.log file.
    fileTransport.maxSize = 1024 * 1024 * 10;

    // Rotate the log file every time we start the app
    fileTransport.archiveLog(logFile);
    logFile.clear();
  }

  // Overwrite the console.log/warn/etc methods
  Object.assign(console, log.functions);
};

export function getLogDirectory(): string {
  const logPath = log.transports.file.getFile().path;
  return dirname(logPath);
}

export default log;
