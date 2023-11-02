import { format } from 'date-fns';
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
    projectIds: RemoteProjectId[];
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
    private _queueLocalFilesByProject: Set<string> = new Set();
    private _queueLocalFilesNoProject: Set<string> = new Set();

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
    private _remoteFileSnapshot: RemoteFileSnapshot | null = null;

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

    public async scan(): Promise<void> {
        // first clear the maps
        this._clear();

        await this._findUntrackedLegacyRemoteProjectsAndFiles();
        await this._findUntrackedProjectsAndFiles();
        await this._findUntrackedFiles();
    }

    public async start(local: boolean): Promise<void> {
        try {
            // regardless of local or remote migration, we still need to get personal workspace records to prevent conflict
            this._logger.info(`[migration][${this._status}] initializing`);
            this._status = 'preparing';
            this._updateCommunication('Preparing for bringing your data up to date');

            await this.scan();

            if (!this._canContinue()) {
                this._status = 'invalid';
                this._logger.info(`[migration][${this._status}] nothing untracked`);
                this._updateCommunication('Nothing is untracked');
                return;
            }

            const remoteFileSnapshot = await this._getRemoteFileSnapshot();
            if (!remoteFileSnapshot) {
                return;
            }

            this._remoteFileSnapshot = remoteFileSnapshot;
            this._byRemoteOrgId = remoteFileSnapshot;// TODO: remove
            this._transformRemoteFileSnapshotToMaps(this._remoteFileSnapshot);

            const myWorkspaceId = this._findMyWorkspaceId();
            if (!myWorkspaceId) {
                this._status = 'incomplete';
                this._logger.warn(`[migration]  [status:${this._status}] Could not continue due to missing the personal workspace`);
                this._updateCommunication('Could not continue due to missing the personal workspace');
                // TODO: we could possibly create personal workspace automatically here
                return;
            }

            if (local) {
                await this._handleUntrackedFilesLocally(myWorkspaceId);
                return;
            }

            await this._handleUntrackedFilesRemotely(myWorkspaceId);
        } catch (error) {
            this._logger.error(`[migration][${this._status}] error was thrown`, error);
        }
    }

    public stop(): void {
        this._logger.info(`[migration][${this._status}] migration stopped`);
        if (this._status === 'complete') {
            this._queueLocalProjects.clear();
            this._queueLocalFilesByProject.clear();
            this._byRemoteFileId.clear();
            this._byRemoteProjectId.clear();
            this._byRemoteOrgId = null;
        }
        this._comm.stop();
    }

    private async _getRemoteFileSnapshot(): Promise<RemoteFileSnapshot | null> {
        const response = await this._http.get<RemoteFileSnapshot>('/v1/user/file-snapshot');
        if ('error' in response) {
            this._status = 'incomplete';
            this._logger.error(`[migration][${this._status}] failed to fetch the remote file snapshot`, response);
            this._updateCommunication('Failed to fetch the remote file snapshot');
            return null;
        }

        return response;
    }

    private _canContinue(): boolean {
        return this._queueLocalProjects.size > 0 || this._queueLocalFilesByProject.size > 0 || this._queueLocalFilesNoProject.size > 0;
    }

    private _clear(): void {
        this._queueLocalProjects.clear();
        this._queueLocalFilesByProject.clear();
        this._byRemoteFileId.clear();
        this._byRemoteProjectId.clear();
        this._remoteFileSnapshot = null;
    }

    private _transformRemoteFileSnapshotToMaps(snapshot: RemoteFileSnapshot): void {
        this._logger.info(`[migration][${this._status}] mapping remote file snapshot to comparison maps`);
        const remoteOrgIds = Object.keys(snapshot);
        for (const remoteOrgId of remoteOrgIds) {
            const orgSnapshot = snapshot[remoteOrgId];
            const orgFileIdMap = Object.entries(orgSnapshot.fileIdMap);

            for (const [remoteFileId, remoteProjectId] of orgFileIdMap) {
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
            }
        }
    }

    private async _handleUntrackedFilesLocally(myWorkspaceId: string): Promise<void> {
        const total = this._queueLocalFilesByProject.size + this._queueLocalFilesNoProject.size;
        this._status = 'inProgress';
        // TODO: check the size of queue for projects and files both before this function gets called
        this._updateCommunication('Starting to bringing your data up to date', { completed: 0, total });
        await this._migrateToLocalVault(myWorkspaceId);
        this._validateMigrationResult();
        await this._cleanUpOldProjects();
    }

    private async _handleUntrackedFilesRemotely(myWorkspaceId: string): Promise<void> {
        const total = this._queueLocalFilesByProject.size + this._queueLocalFilesNoProject.size;
        this._status = 'inProgress';
        this._updateCommunication('Starting to bringing your data up to date', { completed: 0, total });
        await this._migrateToCloud(myWorkspaceId);
        this._validateMigrationResult();
        await this._cleanUpOldProjects();
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
            for (const file of files) {
                this._queueLocalFilesByProject.add(file._id);
            }
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
            for (const file of files) {
                this._queueLocalFilesByProject.add(file._id);
            }
        }
        this._logger.info(`[migration][${this._status}] query completed for untracked local projects: `, localProjects);
    }

    private async _findUntrackedFiles(): Promise<void> {
        // Local projects without organizations except scratchpad
        const untrackedFiles = await this._dataStore.find<Workspace>(workspace.type, {
            parentId: null,
        });
        for (const file of untrackedFiles) {
            this._queueLocalFilesNoProject.add(file._id);
        }
        this._logger.info(`[migration][${this._status}] query completed for untracked files: `, untrackedFiles);
    }

    private async _migrateToLocalVault(myWorkspaceId: string): Promise<void> {
        // migrate projects and files by projects
        for (const localProjectId of this._queueLocalProjects.keys()) {
            const docs = await this._dataStore.find<Project>(project.type, { _id: localProjectId });
            if (!docs.length) {
                return;
            }

            const localProject = docs[0];
            const { _id, remoteId, parentId, ...props } = localProject;

            const newProject = await this._dataStore.docCreate<Project>(project.type, { ...props, parentId: myWorkspaceId, remoteId: null });
            this._updateProjects.set(newProject._id, _id);

            const files = await this._dataStore.find<Workspace>(workspace.type, { parentId: localProjectId });
            for (const file of files) {
                await this._dataStore.docUpdate<Workspace>(file, { parentId: newProject._id });
                this._updatedFiles.add(file._id);
                this._updateCommunication(`Upgraded File - ${file.name} out of Project - ${newProject.name}`, { completed: this._updatedFiles.size, total: this._queueLocalFilesByProject.size });
            }
        }

        if (!this._queueLocalFilesNoProject.size) {
            return;
        }

        const timestamp = format(Date.now(), 'MM-dd');
        const vaultName = `Local Vault ${timestamp}`;
        const newLocalVault = await this._dataStore.docCreate<Project>(project.type, { name: vaultName, parentId: myWorkspaceId, remoteId: null });
        for (const fileId of this._queueLocalFilesNoProject.keys()) {
            const docs = await this._dataStore.find<Workspace>(workspace.type, { _id: fileId });
            if (!docs.length) {
                return;
            }

            const file = docs[0];
            await this._dataStore.docUpdate<Workspace>(file, { parentId: newLocalVault._id });
            this._updatedFiles.add(file._id);
            // this._updateCommunication(`Upgraded File - ${file.name} out of Project - ${newProject.name}`, { completed: this._updatedFiles.size, total: this._queueLocalFilesByProject.size });
        }
    }

    private _validateMigrationResult(): void {
        if (this._queueLocalFilesByProject.size + this._queueLocalFilesNoProject.size > this._updatedFiles.size) {
            this._status = 'incomplete';
            const failedFileCount = this._queueLocalFilesByProject.size - this._updatedFiles.size;
            this._updateCommunication(`Failed to upgrade ${failedFileCount} out of ${this._queueLocalFilesByProject.size} files`, undefined);
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
        for (const [, oldId] of this._updateProjects.entries()) {
            const docs = await this._dataStore.find<Project>(project.type, { _id: oldId });
            console.log({ docs });
            const oldProject = docs[0];
            console.log({ oldProject });
            if (!oldProject) {
                console.log('old project does not exist...?!?!??');
                return;
            }
            // this method is "unsafeRemove" because it does not delete its children => used here to make sure we don't delete the children files as we are not creating new files other than the project
            await this._dataStore.removeWhere<Project>(project.type, { _id: oldId });
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

    // due to the restriction on the count of cloud project on collaboration on free plan, we will default to one project
    private async _migrateToCloud(myWorkspaceId: string): Promise<void> {
        const myWorkspaceSnapshot = this._remoteFileSnapshot?.[myWorkspaceId];
        if (!myWorkspaceSnapshot) {
            return;
        }

        if (!myWorkspaceSnapshot.projectIds.length) {
            return;
        }

        const remoteId = myWorkspaceSnapshot.projectIds[0];
        let defaultProject;
        const docs = await this._dataStore.find<Project>(project.type, { remoteId });
        if (!docs.length) {
            const timestamp = format(Date.now(), 'MM-dd');
            const name = `Cloud Sync ${timestamp}`;
            defaultProject = await this._dataStore.docCreate<Project>(project.type, { name, parentId: myWorkspaceId, remoteId });
        } else {
            defaultProject = docs[0];
        }

        for (const fileId of this._queueLocalFilesByProject.keys()) {
            const docs = await this._dataStore.find<Workspace>(workspace.type, { _id: fileId });
            if (!docs.length) {
                return;
            }

            const file = docs[0];
            await this._dataStore.docUpdate<Workspace>(file, { parentId: defaultProject._id });
            this._updatedFiles.add(file._id);
        }

        for (const fileId of this._queueLocalFilesNoProject.keys()) {
            const docs = await this._dataStore.find<Workspace>(workspace.type, { _id: fileId });
            if (!docs.length) {
                return;
            }

            const file = docs[0];
            await this._dataStore.docUpdate<Workspace>(file, { parentId: defaultProject._id });
            this._updatedFiles.add(file._id);
            // this._updateCommunication(`Upgraded File - ${file.name} out of Project - ${newProject.name}`, { completed: this._updatedFiles.size, total: this._queueLocalFilesByProject.size });
        }
    }
}
