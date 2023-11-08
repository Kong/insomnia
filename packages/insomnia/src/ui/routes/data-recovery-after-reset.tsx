import React from 'react';
import { LoaderFunction, redirect, useLoaderData } from 'react-router-dom';

import { getCurrentSessionId } from '../../account/session';
import * as session from '../../account/session';
import { database } from '../../common/database';
import * as models from '../../models'; // TODO: probably import separately?
import { Project } from '../../models/project';
import { Workspace } from '../../models/workspace';
import { getOrCreateByParentId } from '../../models/workspace-meta';
import { initializeLocalBackendProjectAndMarkForSync, pushSnapshotOnInitialize } from '../../sync/vcs/initialize-backend-project';
import { VCSInstance } from '../../sync/vcs/insomnia-sync';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

const getOrCreateDefaultProject = async (defaultProjectId: string, orgId: string): Promise<Project> => {
  console.log('[reset-passphrase] finding the personal workspace id');
  let defaultProject: Project | null = null;
  const projectDocs = await database.find<Project>(models.project.type, { remoteId: defaultProjectId });
  if (!projectDocs.length) {
    // create
    console.log('[reset-passphrase] project matching remote project not found. creating one...');
    defaultProject = await database.docCreate<Project>(models.project.type, { name: 'Default Cloud Project', parentId: orgId, remoteId: defaultProjectId });
  } else {
    console.log('[reset-passphrase] project matching remote project found');
    defaultProject = projectDocs[0];
  }
  return defaultProject;
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
  backupProjects: BackupProjectInfo[];
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
    console.error('[reset-passphrase] network error - /v1/accounts/backup-projects:', response.message);
    return null;
  }

  // there is no records for this => means there was nothing in the cloud, so we can redirect to org page
  if (!response.backupProjects.length) {
    return redirect('/organization');
  }

  // data recovery & repair starting
  console.log('[reset-passphrase] data recovery after resetting the passphrase starting...');
  // initialize vcs
  // TODO(marckong): move this out of renderer process and initialize it as a singleton there
  const vcs = VCSInstance();

  console.log('[reset-passphrase] fetching remote file snapshot');
  // TODO(marckong): this way of waterfall on the network request is not great. Refactor this.
  const remoteFileSnapshotResponse = await window.main.insomniaFetch<RemoteFileSnapshot | ErrorResponse>({
    method: 'GET',
    path: '/v1/user/file-snapshot',
    sessionId,
  });

  if ('error' in remoteFileSnapshotResponse) {
    console.error('[reset-passphrase] network error - /v1/user/file-snapshot:', remoteFileSnapshotResponse.message);
    return { error: remoteFileSnapshotResponse.message };
  }

  console.log('[reset-passphrase] finding the personal workspace id');
  const remotePersonalWorkspaceId = Object.keys(remoteFileSnapshotResponse).find(remoteOrgId => remoteFileSnapshotResponse![remoteOrgId].isPersonal && remoteFileSnapshotResponse![remoteOrgId].ownedByMe);
  if (!remotePersonalWorkspaceId) {
    console.warn('[reset-passphrase] could not find the personal workspace id');
    return { error: 'Personal Workspace does not exist. Please contact the support if it still persists after trying to reload.' };
  }

  const filesForSync: Workspace[] = [];
  const myWorkspaceSnapshot = remoteFileSnapshotResponse[remotePersonalWorkspaceId];
  if (!myWorkspaceSnapshot.projectIds?.length) {
    return { error: 'Default team project does not exist. Please contact the support if it still persists after trying to reload.' };
  }

  // starting here for the database buffer change holding
  const flushId = await database.bufferChanges();

  const defaultProjectId = myWorkspaceSnapshot.projectIds[0]; // picked the first to reflect on the constraint for free tier users
  console.log('[reset-passphrase] finding the personal workspace id');
  const defaultProject = await getOrCreateDefaultProject(defaultProjectId, remotePersonalWorkspaceId);

  for (const backupInfo of response.backupProjects) {
    // nullify the existing version controlled files to reset with the same root document id
    console.log('[reset-passphrase] recovering file: ', backupInfo.rootDocumentId);
    const docs = await database.find<Workspace>(models.workspace.type, { _id: backupInfo.rootDocumentId });
    if (!docs.length) {
      continue;
    }

    const file = docs[0];
    const updated = await database.docUpdate(file, {
      parentId: backupInfo.teamProjectId,
    });

    filesForSync.push(updated);
  }

  if (!filesForSync.length) {
    await database.flushChanges(flushId);
    return { error: 'Failed to update the local database and query the results' };
  }

  // auto push
  for (const fileForSync of filesForSync) {
    console.log('[reset-passphrase] syncing with the cloned file: ', fileForSync._id);
    // nullify existing previous insomnia sync versions


    console.log('[reset-passphrase] syncing with the cloned file: ', fileForSync._id);
    const fileMeta = await getOrCreateByParentId(fileForSync._id);
    try {
      if (!fileMeta.gitRepositoryId) {
        await vcs.resetVersion(fileForSync._id);

        let project;
        if (fileForSync.parentId === defaultProject._id) {
          project = defaultProject;
        } else {
          const docsPrj = await database.find<Project>(models.project.type, { _id: fileForSync.parentId });
          project = docsPrj?.length ? docsPrj[0] : defaultProject;
        }
        // const docsPrj = await database.find<Project>(models.project.type, { _id: fileForSync.parentId });
        // const project = docsPrj?.le
        console.log(`[migration] syncing a file - ${fileForSync._id}: ${fileForSync.name}`);
        await initializeLocalBackendProjectAndMarkForSync({ vcs, workspace: fileForSync });
        await pushSnapshotOnInitialize({ vcs, project, workspace: fileForSync });
      }
    } catch (e) {
      console.warn('[reset-passphrase] failed to sync the cloned file', e);
      await database.flushChanges(flushId);
      continue;
    }
  }

  // successfully recovered all the data that existed in the cloud
  console.log('[reset-passphrase] removing the flag from the session storage after remote cleaning');
  window.sessionStorage.removeItem('hasResetPassphrase');
  // not deleting the projects for now
  console.log('[reset-passphrase] redirecting to organization page');
  await database.flushChanges(flushId);
  return redirect('/organization');
};

export const DataRecoveryAfterReset = () => {
  const data = useLoaderData() as { error: string };
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
                <h1 className='text-xl font-bold text-center'>Data Recovery After Reset</h1>
                <div className='flex flex-col gap-4'>
                  <p>
                    You've resetted your passphrase. We are processing your local files to recover your data.
                  </p>
                  {data?.error && <p>{data?.error}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </TrailLinesContainer>
    </div>
  );
};
