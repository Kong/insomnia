import clone from 'clone';
import type { LogFunctions } from 'electron-log';

import type { NeDBStore } from '../../../common/database';
import { generateId } from '../../../common/misc';
import { canSync, workspace } from '../../../models';
import Store from '../../../sync/store';
import { BaseDriver } from '../../../sync/store/drivers/base';
import compress from '../../../sync/store/hooks/compress';
import { BackendProject, Branch, DocumentKey, Snapshot, SnapshotState, Stage, StageEntry, StatusCandidate } from '../../../sync/types';
import * as paths from '../../../sync/vcs/paths';
import { getStagable, hash } from '../../../sync/vcs/util';
import { _generateSnapshotID, EMPTY_HASH } from '../../../sync/vcs/vcs';

export class VersionClient {
    private _fileStore: Store;
    private _logger: LogFunctions;
    private _dataStore: NeDBStore;

    constructor(
        logger: LogFunctions,
        driver: BaseDriver,
        dataStore: NeDBStore
    ) {
        this._logger = logger;
        // two stores operating at the same time works without any conflict? probably better to pass it down from the top. so much tech debt
        this._fileStore = new Store(driver, [compress]);
        this._dataStore = dataStore;
    }

    /**
     * This fucntion is huge intentionally as I am bring all the logic from vcs.ts file. I need to have better cognitive understanding of the file.
     * taken mostly from { initializeLocalBackendProjectAndMarkForSync } from initialize-backend-project.ts
     * what is the backend project?? we have team-project, project in the database, and Project.db and Workspace.db
     * This is confusing.
     */
    public async versionLocalFile(localFileName: string, localFileId: string): Promise<void> {
        this._logger.info('versioning local file: ', localFileId);
        // this is the first time versioning a local file right immediately after migration
        // this can be also referred when,
        // -- switching inbetween local vault or cloud sync
        // -- resetting passphrase

        // 1. write a versioning file into the file system
        // BackendProject creates a great confusion for us between NeDB Project, this Project and BackendProject (mind-blowing)
        const versioningFile: BackendProject = {
            id: generateId('prj'),
            name: localFileName,
            rootDocumentId: localFileId,
        };

        await this._fileStore.setItem(paths.project(versioningFile.id), versioningFile);

        // 2. query the file with all of its decesdents
        const docs = await this._dataStore.find(workspace.type, { _id: localFileId });
        if (!docs?.length) {
            return;
        }

        const file = docs[0];
        const files = await this._dataStore.withDescendants(file);

        // 3. initialize unstaged states for all of the queried files, but exclude the private stuff
        const candidates: StatusCandidate[] = files
            .filter(canSync)
            .map(document => ({ key: document._id, name: document.name || '', document }));

        // Inherited from the previous implementation. Please help me understand WHY we are doing this if this is going to be an empty object??
        const blankStage = {};

        // this comes from vcs.status function.
        const initialStage = clone<Stage>(blankStage); // what? why?

        // 4. create a head
        await this._fileStore.setItem(paths.head(versioningFile.id), { branch: 'main' }); // no more slavery
        const head = await this._fileStore.getItem(paths.head(versioningFile.id));

        // 5. create a branch
        // branch name validation is needed ONLY WHEN we are letting users set. This is machine setting it.
        await this._fileStore.setItem(paths.branch(versioningFile.id, head.branch.toLowerCase()), {
            name: head.branch,
            created: new Date(),
            modified: new Date(),
            snapshots: [],
        });
        const branch = await this._fileStore.getItem(paths.branch(versioningFile.id, head.branch)) as Branch;

        // 6. create the first snapshot
        const snapshots = branch ? branch.snapshots : [];
        const parentId = snapshots.length ? snapshots[snapshots.length - 1] : EMPTY_HASH;
        const latestSnapshot = await this._fileStore.getItem(paths.snapshot(versioningFile.id, parentId)) as Snapshot;
        if (latestSnapshot && typeof latestSnapshot.created === 'string') {
            latestSnapshot.created = new Date(latestSnapshot.created);
        }

        const state = latestSnapshot ? latestSnapshot.state : [];
        const unstaged: Record<DocumentKey, StageEntry> = {};
        for (const entry of getStagable(state, candidates)) {
            const { key } = entry;
            const stageEntry = initialStage[key];

            if (!stageEntry || stageEntry.blobId !== entry.blobId) {
                unstaged[key] = entry;
            }
        }
        const status = {
            stage: initialStage,
            unstaged,
            key: hash({ stage: initialStage, unstaged }).hash,
        };

        // 7. stage everything so far
        const newStage = clone<Stage>(blankStage); // why reusing the blankStage the empty object?
        const blobsToStore: Record<string, string> = {};
        const stageEntries = Object.values(status.unstaged);
        for (const stageEntry of stageEntries) {
            newStage[stageEntry.key] = stageEntry;

            // Only store blobs if we're not deleting it
            if (('added' in stageEntry) && stageEntry.added || ('modified' in stageEntry) && stageEntry.modified) {
                blobsToStore[stageEntry.blobId] = stageEntry.blobContent;
            }
        }

        // 8. store all the blobs
        const jobs: Promise<any>[] = [];
        for (const id of Object.keys(blobsToStore)) {
            const buff = Buffer.from(blobsToStore[id], 'utf8');
            const job = this._fileStore.setItem(paths.blob(versioningFile.id, id), buff);
            jobs.push(job);
        }
        await Promise.all(jobs);

        // 9. commit
        const theBranch = await this._fileStore.getItem(paths.branch(versioningFile.id, head.branch)) as Branch;
        const snapshotsFromBranch = theBranch ? theBranch.snapshots : [];
        const parentSnapshotId = snapshotsFromBranch.length ? snapshotsFromBranch[snapshotsFromBranch.length - 1] : EMPTY_HASH;

        const parentSnapshot: Snapshot = await this._fileStore.getItem(paths.snapshot(versioningFile.id, parentSnapshotId));
        if (parentSnapshot && typeof parentSnapshot.created === 'string') {
            parentSnapshot.created = new Date(parentSnapshot.created);
        }

        const parentSnapshotState: SnapshotState = [];
        // Add everything from the old state
        for (const parentStageEntry of parentSnapshot ? parentSnapshot.state : []) {
            // Don't add anything that's in the stage (this covers deleted things too :])
            if (newStage[parentStageEntry.key]) {
                continue;
            }

            parentSnapshotState.push(parentStageEntry);
        }

        for (const key of Object.keys(newStage)) {
            const entry = newStage[key];

            if ('deleted' in entry && entry.deleted) {
                continue;
            }

            const { name, blobId: blob } = entry;
            parentSnapshotState.push({
                key,
                name,
                blob,
            });
        }

        const newParentId = theBranch.snapshots.length
            ? theBranch.snapshots[theBranch.snapshots.length - 1]
            : EMPTY_HASH;

        const id = _generateSnapshotID(newParentId, versioningFile.id, parentSnapshotState);
        const lastSnapshot: Snapshot = {
            id,
            name: 'Initial Snapshot from upgrading',
            state,
            author: '',
            parent: newParentId,
            created: new Date(),
            description: '',
        };

        theBranch.modified = new Date();
        theBranch.snapshots.push(lastSnapshot.id);
        await this._fileStore.setItem(paths.branch(versioningFile.id, theBranch.name.toLowerCase()), theBranch);
        await this._fileStore.setItem(paths.snapshot(versioningFile.id, lastSnapshot.id), lastSnapshot);

        // after this, Sync them against the remote
        // const localBranch = await this._getCurrentBranch();
        // const remoteBranch = await this._queryBranch(localBranch.name);
        // return compareBranches(localBranch, remoteBranch);
        return;
    }
}
