import { BrowserWindow, ipcMain } from 'electron';
import type { LogFunctions } from 'electron-log';
import log from 'electron-log';

import { database } from '../../common/database';
import { CommunicationService } from './services/communication';
import { HttpClient } from './services/http';
import { IdentityService } from './services/identity';
import { MigrationService } from './services/migration';

function initializeLoggerForMigration(): LogFunctions {
    const migrationLogger = log.create('migrationLogger');
    migrationLogger.transports.file.fileName = 'migration.log';
    return migrationLogger;
}
const logger = initializeLoggerForMigration();
export interface MigrationStartHandleOptions {
    sessionId: string;
    accountId: string;
    prefersProjectType: 'local' | 'remote';
}
export const registerMigrationHandlers = (receiver: BrowserWindow) => {
    const identity = new IdentityService(logger);
    const httpClient = new HttpClient(logger, identity);
    const communication = new CommunicationService(logger, receiver);
    const service = new MigrationService(logger, httpClient, communication, database);

    ipcMain.handle('migration.start', (_, options: MigrationStartHandleOptions) => {
        try {
            if (!options?.sessionId || !options?.accountId) {
                logger.warn('[migration][ipcMain:migration.start] account not signed in');
                return;
            }

            logger.info(`[migration][ipcMain:migration.start] migration selection for ${options.prefersProjectType ?? 'local'} - preferred team project type`);

            communication.broadcast();
            identity.setIdentity(options.sessionId, options.accountId);
            service.start(options.prefersProjectType === 'local');
        } catch (error) {
            logger.error('[migration][ipcMain:migration.start] migration preparation failed', error);
        }
    });

    ipcMain.handle('migration.stop', () => {
        try {
            logger.info('[migration][ipcMain:migration.stop] stopping the migiration');
            service.stop();
        } catch (error) {
            logger.error('[migration][ipcMain:migration.stop] failed to stop the migration', error);
        }
    });

    ipcMain.handle('migration.scan', () => {
        try {
            logger.info('[migration][ipcMain:migration.scan] scanning untracked files for migration');
            service.scan();
        } catch (error) {
            logger.error('[migration][ipcMain:migration.scan] failed to stop the migration', error);
        }
    });
};

export interface MigrationBridgeAPI {
    start: (options: MigrationStartHandleOptions) => Promise<void>;
    stop: () => Promise<void>;
    scan: () => Promise<void>;
};
