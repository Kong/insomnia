import React from 'react';
import { Button, Heading, Radio, RadioGroup } from 'react-aria-components';
import { ActionFunction, LoaderFunction, redirect, useFetcher } from 'react-router-dom';

import { getCurrentSessionId } from '../../account/session';
import * as session from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models'; // TODO: probably import separately?
import { Project } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { getOrCreateByParentId } from '../../models/workspace-meta';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { MergeConflict } from '../../sync/types';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from '../../sync/vcs/initialize-backend-project';
import { getVCS, initVCS, VCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { Icon } from '../components/icon';
import { InsomniaLogo } from '../components/insomnia-icon';
import { showModal } from '../components/modals';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';
import { TrailLinesContainer } from '../components/trail-lines-container';

export const autoSyncForMigration = async (files: Workspace[], vcs: VCS) => {
  for (const file of files) {
    const docs = await database.find<Project>(models.project.type, { _id: file.parentId });
    if (!docs.length) {
      // at this point, this shouldn't happen but just in case.
      console.log('[migration] you are one of the rare lucky user');
      continue;
    }

    const project = docs[0];
    const workspaceMeta = await getOrCreateByParentId(file._id);
    // Initialize Sync on the workspace if it's not using Git sync
    try {
      if (!workspaceMeta.gitRepositoryId) {
        console.log(`[migration] syncing a file - ${file._id}: ${file.name}`);
        await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace: file });
        await pushSnapshotOnInitialize({ vcs, project, workspace: file });
      }
    } catch (e) {
      console.warn('Failed to initialize sync on workspace. This will be retried when the workspace is opened on the app.', e);
    }
  }
};

interface ErrorResponse {
  error: string;
  message: string;
}
interface BackupProjectInfo {
  originalProjectId: string;
  rootDocumentId: string;
  teamProjectId: string;
}

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

// it is named as "backup", but actually there is no backup.
// we do keep the track of ids only for this. Encrypted data without passphrase that the user forgot
// just means it is not valid data the system should carry on.
// However, root_document_id (Workspace.db entity id) is used for versioning, so we must clean this up locally here
interface BackupProjectResponse {
  projects: BackupProjectInfo[];
}
export const loader: LoaderFunction = async () => {
  const sessionId = getCurrentSessionId();
  if (!sessionId) {
    await session.logout();
    return redirect('/auth/login');
  }

  const response = await window.main.insomniaFetch<BackupProjectResponse | ErrorResponse>({
    method: 'GET',
    path: '/v1/accounts/backup-projects',
    sessionId,
  });

  if ('error' in response) {
    // show nice error and give feedback to the user with action buttons
    // instead of throwing error
    return null;
  }

  // there is no records for this => means there was nothing in the cloud, so we can redirect to org page
  if (!response.projects.length) {
    return redirect('/organization');
  }

  // data recovery & repair starting
  console.log('[reset-passphrase] data recovery after resetting the passphrase starting...');
  // initialize vcs
  // TODO(marckong): move this out of renderer process and initialize it as a singleton there
  let vcs = getVCS();
  if (!vcs) {
    const driver = FileSystemDriver.create(
      process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
    );

    console.log('Initializing VCS');
    vcs = await initVCS(driver, async conflicts => {
      return new Promise(resolve => {
        showModal(SyncMergeModal, {
          conflicts,
          handleDone: (conflicts?: MergeConflict[]) =>
            resolve(conflicts || []),
        });
      });
    });
  }

  console.log('[reset-passphrase] fetching remote file snapshot');
  // TODO(marckong): this way of waterfall on the network request is not great. Refactor this.
  const remoteFileSnapshotResponse = await window.main.insomniaFetch<RemoteFileSnapshot | ErrorResponse>({
    method: 'GET',
    path: '/v1/user/file-snapshot',
    sessionId,
  });

  if ('error' in remoteFileSnapshotResponse) {
    console.error('[reset-passphrase] network error:', remoteFileSnapshotResponse.message);
    // show nice error and give feedback to the user with action buttons
    // instead of throwing error
    return null;
  }

  console.log('[reset-passphrase] finding the personal workspace id');
  const remotePersonalWorkspaceId = Object.keys(response).find(remoteOrgId => remoteFileSnapshotResponse![remoteOrgId].isPersonal && remoteFileSnapshotResponse![remoteOrgId].ownedByMe);
  if (!remotePersonalWorkspaceId) {
    console.warn('[reset-passphrase] could not find the personal workspace id');
    // show nice error and give feedback to the user with action buttons
    // instead of throwing error
    return null;
  }

  const filesForSync: Workspace[] = [];
  const myWorkspaceSnapshot = remoteFileSnapshotResponse[remotePersonalWorkspaceId];
  if (!myWorkspaceSnapshot.projectIds[0]) {
    // TODO: create a remote project for the user here instead of returning null
    return null;
  }

  const defaultProjectId = myWorkspaceSnapshot.projectIds[0]; // picked the first to reflect on the constraint for free tier users
  console.log('[reset-passphrase] finding the personal workspace id');
  let defaultProject: Project | null = null;
  const projectDocs = await database.find<Project>(models.project.type, { remoteId: defaultProjectId });
  if (!projectDocs.length) {
    // create
    console.log('[reset-passphrase] project matching remote project not found. creating one...');
    defaultProject = await database.docCreate<Project>(models.project.type, { name: 'Backup After Reset', parentId: remotePersonalWorkspaceId, remoteId: defaultProjectId });
  } else {
    console.log('[reset-passphrase] project matching remote project found');
    defaultProject = projectDocs[0];
    // TODO: update the remote project name as well with 'Backup After Reset
  }

  for (const backupInfo of response.projects) {
    console.log('[reset-passphrase] recovering file: ', backupInfo.rootDocumentId);
    const docs = await database.find<Workspace>(models.workspace.type, { _id: backupInfo.rootDocumentId });
    if (!docs.length) {
      continue;
    }

    const file = docs[0];
    const newFile = await database.duplicate(file, {
      parentId: defaultProject._id,
    });
    filesForSync.push(newFile);
  }

  if (filesForSync.length) {
    return;
  }

  // auto push
  for (const fileForSync of filesForSync) {
    console.log('[reset-passphrase] syncing with the cloned file: ', fileForSync._id);
    const fileMeta = await getOrCreateByParentId(fileForSync._id);
    try {
      if (!fileMeta.gitRepositoryId) {
        console.log(`[migration] syncing a file - ${fileForSync._id}: ${fileForSync.name}`);
        await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace: fileForSync });
        await pushSnapshotOnInitialize({ vcs, project: defaultProject, workspace: fileForSync });
      }
    } catch (e) {
      console.warn('[reset-passphrase] failed to sync the cloned file', e);
      continue;
    }
  }

  const fileIdsForCleanUp = response.projects.map(info => info.rootDocumentId);
  for (const deleteId of fileIdsForCleanUp) {
    console.log('[reset-passphrase] deleting the duplicate record of the original: ', deleteId);
    await database.removeWhere(models.workspace.type, { _id: deleteId });
  }

  const deleteBackupProjectsResponse = await window.main.insomniaFetch<ErrorResponse>({
    method: 'DELETE',
    path: '/v1/account/backup-projects',
    sessionId,
  });

  console.log('[reset-passphrase] cleaning up the backup records');
  if ('error' in deleteBackupProjectsResponse) {
    console.error('[reset-passphrase] network failed: ', deleteBackupProjectsResponse);
    // show nice error and give feedback to the user with action buttons
    // instead of throwing error
    return null;
  }

  // successfully recovered all the data that existed in the cloud
  console.log('[reset-passphrase] removing the flag from the session storage after remote cleaning');
  window.sessionStorage.removeItem('hasResetPassphrase');
  // not deleting the projects for now
  console.log('[reset-passphrase] redirecting to organization page');
  return redirect('/organization');
};

interface MigrationActionData {
  error?: string;
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const type = formData.get('type');
  invariant(type === 'local' || type === 'remote', 'Expected type to be either local or remote');

  localStorage.setItem('prefers-project-type', type);

  return redirect('/organization');
};

export const Migrate = () => {
  const { Form, state } = useFetcher<MigrationActionData>();

  return (
    <div className='relative h-full w-full text-left text-base flex bg-[--color-bg]'>
      <TrailLinesContainer>
        <div
          className='flex justify-center items-center flex-col h-full w-[540px] min-h-[min(450px,90%)]'
        >
          <div
            className='flex flex-col gap-[var(--padding-sm)] items-center justify-center p-[--padding-lg] pt-12 w-full h-full bg-[--hl-xs] rounded-[var(--radius-md)] border-solid border border-[--hl-sm] relative'
          >
            <InsomniaLogo
              className='transform translate-x-[-50%] translate-y-[-50%] absolute top-0 left-1/2 w-16 h-16'
            />
            <div
              className='flex justify-center items-center flex-col h-full pt-2'
            >
              <div className='text-[--color-font] flex flex-col gap-4'>
                <h1 className='text-xl font-bold text-center'>Collaboration with Cloud Sync now available</h1>
                <div className='flex flex-col gap-4'>
                  <p>
                    Cloud Sync - which used to be a premium feature - is now available on every plan including the Free plan. With Cloud Sync your projects will be automatically synchronized to the cloud in an end-to-end encrypted way (E2EE) and available on every Insomnia client after logging in.
                  </p>

                </div>
                <Form method='POST' className='gap-4 flex flex-col text-left'>
                  <RadioGroup aria-label='Project type' name="type" defaultValue={'local'} className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Radio
                        value="local"
                        className="data-[selected]:border-[--color-surprise] flex-1 data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                      >
                        <Icon icon="laptop" />
                        <Heading className="text-lg font-bold">Keep storing locally in Local Vault</Heading>
                        <p className="pt-2">
                          Stored locally only with no cloud. Ideal when collaboration is not needed.
                        </p>
                      </Radio>
                      <Radio
                        value="remote"
                        className="data-[selected]:border-[--color-surprise] flex-1 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                      >
                        <Icon icon="globe" />
                        <Heading className="text-lg font-bold">Enable Cloud Sync in Secure Cloud</Heading>
                        <p className='pt-2'>
                          End-to-end encrypted (E2EE) and synced securely to the cloud, ideal for collaboration.
                        </p>
                      </Radio>
                    </div>
                  </RadioGroup>
                  <div className='flex justify-end gap-2 items-center'>
                    <Button
                      type="submit"
                      isDisabled={state !== 'idle'}
                      className={'hover:no-underline font-bold bg-[--color-surprise] text-sm hover:bg-opacity-90 py-2 px-3 text-[--color-font] transition-colors rounded-sm' + (state !== 'idle' ? 'animate-pulse cursor-not-allowed' : '')}
                    >
                      Continue
                    </Button>
                  </div>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </TrailLinesContainer>
    </div>
  );
};
