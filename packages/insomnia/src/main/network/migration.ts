import { ipcMain } from 'electron';
import type { LogFunctions } from 'electron-log';
import log from 'electron-log';

import { database } from '../../common/database';
import { project, workspace } from '../../models';
import { insomniaFetch } from '../insomniaFetch';

export interface MigrationServiceImpl {
    prepare: () => Promise<void>;
    start: () => void;
    pause: () => void;
    resume: () => void;
    end: () => void;
}

type Logger = LogFunctions;
export interface MigrationProgress {
    total: number;
    complete: number;
    inProgress: number;
    failed: number;
}

const logger = log.create('migrationLogger');
logger.scope('migration');
logger.transports.file.fileName = 'migration.log';

type HttpClient = typeof insomniaFetch;
class MigrationService implements MigrationServiceImpl {
    private _logger: Logger;
    private _http: HttpClient;
    public queue: Set<string> = new Set();
    public progress$ = new Event('migrationProgress');
    public status$ = new Event('migrationStatus');

    constructor(logger: Logger, http: HttpClient) {
        this._logger = logger;
        this._http = http;
    }

    public async prepare(): Promise<void> {
        this._logger.info('[migration] preparing');
        if (!database) {
            this._logger.warn('[migration] in-memory database is not loaded yet');
            return;
        }

        this._logger.info('[migration] querying database for all untracked projects');

        const untracteds = await database.find(project.type, { remoteId: null, parentId: null, _id: { $ne: 'proj_scratchpad' } });
        const projectsWithoutRemoteId = await database.find(project.type, { remoteId: null, parentId: { $ne: null }, _id: { $ne: 'proj_scratchpad' } });
        const projectsWithoutParentId = await database.find(project.type, { parentId: null, remoteId: { $ne: null }, _id: { $ne: 'proj_scratchpad' } });
        const allProjects = await database.find(project.type, { parentId: { $ne: null }, _id: { $ne: 'proj_scratchpad' } });
        const allWorkspaces = await database.find(workspace.type, { parentId: { $ne: 'proj_scratchpad' } });

        console.log({ allProjects });
        console.log({ allWorkspaces });
        console.log({ untracteds });
        console.log({ projectsWithoutRemoteId });
        console.log({ projectsWithoutParentId });
    }

    // for now, let's call them team projects
    public start(): void {
        if (this.queue.size === 0) {
            this._logger.info('[migration] attempted to start without preparing');
        }
        this._logger.info('[migration] start');
        this.queue.forEach(() => {
            // database.find('project', { remoteId: teamProjectId }).then();
        });
    }

    public resume(): void {
        this._logger.info('[migration] resume');
    }

    public pause(): void {
        this._logger.info('[migration] pause');
    }

    public end(): void {
        this._logger.info('[migration] end');
    }
}
const service = Object.freeze(new MigrationService(logger, insomniaFetch));
export const registerMigrationHandlers = () => {
    ipcMain.handle('migration.prepare', () => service.prepare());
    ipcMain.handle('migration.start', () => service.start());
    ipcMain.handle('migration.pause', () => service.pause());
    ipcMain.handle('migration.resume', () => service.resume());
    ipcMain.handle('migration.end', () => service.end());
};
