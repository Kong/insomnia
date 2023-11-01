import { BrowserWindow, ipcMain } from 'electron';
import type { LogFunctions } from 'electron-log';
import log from 'electron-log';

import { database } from '../../common/database';
import { CommunicationService } from './services/communication';
import { HttpClient } from './services/http';
import { MigrationService } from './services/migration';

function initializeLoggerForMigration(): LogFunctions {
    const migrationLogger = log.create('migrationLogger');
    migrationLogger.transports.file.fileName = 'migration.log';
    return migrationLogger;
}
const logger = initializeLoggerForMigration();
export const registerMigrationHandlers = (receiver: BrowserWindow) => {
    const httpClient = new HttpClient(logger);
    const communication = new CommunicationService(receiver);
    const service = Object.freeze(new MigrationService(logger, httpClient, communication, database));

    ipcMain.handle('migration.start', (_, options: { sessionId: string; prefersProjectType: 'local' | 'remote' }) => {
        try {
            if (!options?.sessionId) {
                logger.warn('[migration] account not signed in');
                return;
            }

            logger.info(`[migration] migration selection for ${options.prefersProjectType ?? 'local'} - preferred team project type`);

            communication.broadcast();
            httpClient.setAuthentication(options.sessionId);
            service.prepare(options.prefersProjectType === 'local');
        } catch (error) {
            logger.error('[migration] migration preparation failed', error);
        }
    });
};
