import { getUserFiles, type Organization, type RemoteFile } from 'insomnia-api';
import type { Project } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { href } from 'react-router';

import { database } from '~/common/database';
import { createFetcherLoadHook } from '~/ui/utils/router';

import type { Route } from './+types/remote-files';

export interface CommandRemoteItem<TItem> {
  id: string;
  url: string;
  pullUrl: string;
  name: string;
  organizationName: string;
  projectName: string;
  workspaceName?: string;
  item: TItem;
}

export interface RemoteFilesLoaderResult {
  files: CommandRemoteItem<RemoteFile & { teamProjectLocalId: string; scope: 'unsynced' }>[];
}

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id: sessionId, accountId } = await services.userSession.get();

  if (!sessionId) {
    return {
      files: [],
    };
  }

  try {
    const remoteFiles = await getUserFiles({ sessionId });

    const allOrganizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];

    const allRemoteFilesOrganizationIds = remoteFiles.map(file => file.organizationId);
    const allRemoteFilesProjectIds = remoteFiles.map(file => file.teamProjectId);

    const organizations = allOrganizations.filter(org => allRemoteFilesOrganizationIds.includes(org.id));

    const projects = await database.find<Project>(models.project.type, {
      remoteId: {
        $in: allRemoteFilesProjectIds,
      },
    });

    const files = remoteFiles.map(file => {
      const parentProject = projects.find(project => project.remoteId === file.teamProjectId);
      return {
        id: file.id,
        url: href('/organization/:organizationId', {
          organizationId: file.organizationId,
        }),
        pullUrl: parentProject
          ? `/organization/${file.organizationId}/project/${file.teamProjectId}/remote-collections/pull`
          : '',
        name: file.name,
        item: { ...file, teamProjectLocalId: parentProject?._id || '', scope: 'unsynced' as const },
        organizationName: organizations.find(org => org.id === file.organizationId)?.display_name || '',
        projectName: parentProject?.name || '',
      };
    });

    return {
      files,
    };
  } catch {
    return {
      files: [],
    };
  }
}

export const useRemoteFilesLoaderFetcher = createFetcherLoadHook(
  load => () => {
    return load(href('/remote-files'));
  },
  clientLoader,
);
