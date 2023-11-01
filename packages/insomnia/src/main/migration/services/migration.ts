import type { LogFunctions } from 'electron-log';

import { database } from '../../../common/database';
import { project, workspace } from '../../../models';
import { Project } from '../../../models/project';
import { Workspace } from '../../../models/workspace';
import type { CommunicationService } from './communication';
import type { HttpClient } from './http';

type DataStore = typeof database;
type MigrationStatus = 'invalid' | 'idle' | 'preparing' | 'ready' | 'inProgress' | 'incomplete' | 'complete';
interface MigrationProgress {
    completed: number;
    total: number;
}
interface MigrationUpdate {
    status: MigrationStatus;
    message: string;
    progress?: MigrationProgress;
}
const MIGRATION_MSG_LABEL = 'migration:status';
type RemoteOrganizationId = string;
type RemoteFileId = string; // project id
type RemoteProjectId = string; // team project id
type LocalWorkspaceToLocalProjectMap = Record<RemoteFileId, RemoteProjectId>;
interface OwernshipSnapshot {
    ownedByMe: boolean;
    isPersonal: boolean;
    fileIdMap: LocalWorkspaceToLocalProjectMap;
}

type RemoteFileSnapshot = Record<RemoteOrganizationId, OwernshipSnapshot>;
export class MigrationService {
    /**
     * Services
     */
    private _logger: LogFunctions;
    private _http: HttpClient;
    private _comm: CommunicationService;
    private _dataStore: DataStore;

    /**
     * Queue maps for bookeeping migration activities
     */
    private _queueLocalProjects: Set<string> = new Set();
    private _queueLocalFiles: Set<string> = new Set();

    /**
     * Maps to track updated entity ids
     */
    private _updateProjects: Map<string, string> = new Map();
    private _updatedFiles: Set<string> = new Set();

    private _status: MigrationStatus = 'idle';

    /**
     * Maps to compare against the remote state
     */
    private _byRemoteProjectId: Map<RemoteProjectId, RemoteOrganizationId> = new Map();
    private _byRemoteFileId: Map<RemoteFileId, {
        remoteOrgId: RemoteOrganizationId;
        remoteProjectId: RemoteProjectId;
    }> = new Map();
    private _byRemoteOrgId: RemoteFileSnapshot | null = null;

    // TODO: handle conflict situation
    // private _mapResourceConflicts: Map<string, {
    //     type: 'remoteProject' | 'remoteFile';
    //     reason: string;
    // }> = new Map();

    constructor(
        logger: LogFunctions,
        http: HttpClient,
        comm: CommunicationService,
        dataStore: DataStore,
    ) {
        this._logger = logger;
        this._http = http;
        this._comm = comm;
        this._dataStore = dataStore;
    }

    public async prepare(local: boolean): Promise<void> {
        // regardless of local or remote migration, we still need to get personal workspace records to prevent conflict
        this._logger.info(`[migration][${this._status}] initializing`);
        this._status = 'preparing';
        this._updateCommunication('Preparing for bringing your data up to date');

        this._logger.info(`[migration][${this._status}] fetching the remote file snapshot`);
        const response = await this._http.get<RemoteFileSnapshot>('/v1/user/files');
        if ('error' in response) {
            this._status = 'incomplete';
            this._logger.error(`[migration][${this._status}] failed to fetch the remote file snapshot`, response);
            this._updateCommunication('Failed to fetch the remote file snapshot');
            return;
        }

        this._byRemoteOrgId = response;
        this._transformRemoteFileSnapshotToMaps(response);
        this._findUntrackedLegacyRemoteProjectsAndFiles();
        this._findUntrackedProjectsAndFiles();

        if (local) {
            this._logger.info(`[migration][${this._status}] continuing to migrate locally`);
            this._handleUntrackedFilesLocally();
            return;
        }

        this._logger.info(`[migration][${this._status}] continuing to migrate remotely`);
        this._handleUntrackedFilesRemotely();
    }

    private _transformRemoteFileSnapshotToMaps(snapshot: RemoteFileSnapshot): void {
        this._logger.info(`[migration][${this._status}] mapping remote file snapshot to comparison maps`);
        const remoteOrgIds = Object.keys(snapshot);
        remoteOrgIds.forEach(remoteOrgId => {
            const orgSnapshot = snapshot[remoteOrgId];
            const orgFileIdMap = Object.entries(orgSnapshot.fileIdMap);
            orgFileIdMap.forEach(([remoteFileId, remoteProjectId]) => {
                if (this._byRemoteFileId.has(remoteFileId)) {
                    this._logger.warn(`[migration][${this._status}] conflicting remote file resource `, remoteFileId);
                    // const conflictedResource = this._byRemoteFileId.get(remoteFileId);
                    // this._mapResourceConflicts.set();
                    // this._logger.error(`[migration][${this._status}] [RemoteFileId:${remoteFileId}]`, response);
                    return;
                }

                this._byRemoteFileId.set(remoteFileId, { remoteProjectId, remoteOrgId });
                this._logger.info(`[migration][${this._status}] remote file mapped `, { remoteFileId, remoteProjectId, remoteOrgId });

                if (this._byRemoteProjectId.has(remoteProjectId)) {
                    this._logger.warn(`[migration][${this._status}] conflicting remote team project resource `, remoteProjectId);
                    // this._logger.error(`[migration][${this._status}] [RemoteFileId:${remoteFileId}]`, response);
                    return;
                }
                this._logger.info(`[migration][${this._status}] remote file mapped `, { remoteProjectId, remoteOrgId });
                this._byRemoteProjectId.set(remoteProjectId, remoteOrgId);
            });
        });
    }

    private async _handleUntrackedFilesLocally(): Promise<void> {
        const myWorkspaceId = this._findMyWorkspaceId();
        if (!myWorkspaceId) {
            // TODO: we could possibly create personal workspace automatically here
            return;
        }

        this._status = 'inProgress';
        // TODO: check the size of queue for projects and files both before this function gets called
        this._updateCommunication('Starting to bringing your data up to date', { completed: 0, total: this._queueLocalFiles.size });
        this._migrateLocalProjects(myWorkspaceId);
        this._validateMigrationResult();
        this._cleanUpOldProjects();
    }

    private async _handleUntrackedFilesRemotely(): Promise<void> {
        return;
    }

    private _findMyWorkspaceId(): string | undefined {
        if (!this._byRemoteOrgId) {
            return;
        }

        const remotePersonalWorkspaceId = Object.keys(this._byRemoteOrgId).find(remoteOrgId => this._byRemoteOrgId![remoteOrgId].isPersonal && this._byRemoteOrgId![remoteOrgId].ownedByMe);
        if (!remotePersonalWorkspaceId) {
            return;
        }

        return remotePersonalWorkspaceId;
    }

    private async _findUntrackedLegacyRemoteProjectsAndFiles(): Promise<void> {
        this._logger.info(`[migration][${this._status}] querying legacy remote projects (migration required team projects)`);
        const legacyRemoteProjects = await this._dataStore.find<Project>(project.type, {
            remoteId: { $ne: null },
            parentId: null,
        });
        this._logger.info(`[migration][${this._status}] query completed for untracked legacy remote projects: `, legacyRemoteProjects);
        for (const project of legacyRemoteProjects) {
            this._queueLocalProjects.add(project._id);

            const files = await this._dataStore.find<Workspace>(workspace.type, { parentId: project._id });
            files.forEach(fileItem => this._queueLocalFiles.add(fileItem._id));
        }
    }

    private async _findUntrackedProjectsAndFiles(): Promise<void> {
        // Local projects without organizations except scratchpad
        const localProjects = await this._dataStore.find<Project>(project.type, {
            remoteId: null,
            parentId: null,
            _id: { $ne: project.SCRATCHPAD_PROJECT_ID },
        });
        for (const project of localProjects) {
            this._queueLocalProjects.add(project._id);

            const files = await this._dataStore.find<Workspace>(workspace.type, { parentId: project._id });
            files.forEach(fileItem => this._queueLocalFiles.add(fileItem._id));
        }
        this._logger.info(`[migration][${this._status}] query completed for untracked local projects: `, localProjects);
    }

    private async _migrateLocalProjects(myWorkspaceId: string): Promise<void> {
        for (const localProjectId of this._queueLocalProjects) {
            const docs = await this._dataStore.find<Project>(project.type, { _id: localProjectId });
            const localProject = docs[0];
            if (!localProject) {
                return;
            }

            const { _id, remoteId, parentId, ...props } = localProject;

            const newProject = await this._dataStore.docCreate<Project>(project.type, { ...props, parentId: myWorkspaceId, remoteId: null });
            this._updateProjects.set(newProject._id, _id);

            const files = await this._dataStore.find<Workspace>(workspace.type, { parentId: localProjectId });
            for (const file of files) {
                await this._dataStore.docUpdate<Workspace>(file, { parentId: newProject._id });
                this._updatedFiles.add(file._id);
                this._updateCommunication(`Upgraded File - ${file.name} out of Project - ${newProject.name}`, { completed: this._updatedFiles.size, total: this._queueLocalFiles.size });
            }
        }
    }

    private _validateMigrationResult(): void {
        if (this._queueLocalFiles.size > this._updatedFiles.size) {
            this._status = 'incomplete';
            const failedFileCount = this._queueLocalFiles.size - this._updatedFiles.size;
            this._updateCommunication(`Failed to upgrade ${failedFileCount} out of ${this._queueLocalFiles.size} files`, undefined);
            return;
        }

        if (this._queueLocalProjects.size > this._updateProjects.size) {
            this._status = 'incomplete';
            const failedProjectCount = this._queueLocalProjects.size - this._updateProjects.size;
            this._updateCommunication(`Failed to upgrade ${failedProjectCount} out of ${this._updateProjects.size} projects`, undefined);
            return;
        }
    }

    private async _cleanUpOldProjects(): Promise<void> {
        for (const [, oldId] of this._updateProjects) {
            const docs = await this._dataStore.find<Project>(project.type, { _id: oldId });
            const oldProject = docs[0];
            if (!oldProject) {
                return;
            }
            await this._dataStore.unsafeRemove<Project>(oldProject);
            this._queueLocalProjects.delete(oldId);
        }

        this._status = 'complete';
        this._updateCommunication('Completed upgrade', undefined);
        return;
    }

    private _updateCommunication(message: string, progress?: MigrationProgress): void {
        const update: MigrationUpdate = { status: this._status, message };
        if (progress) {
            update.progress = progress;
        }

        this._comm.publish<MigrationUpdate>(MIGRATION_MSG_LABEL, update);
    }
}
