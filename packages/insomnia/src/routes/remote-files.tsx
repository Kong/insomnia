import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { database } from '~/common/database';
import { project, userSession } from '~/models';
import { type Organization } from '~/models/organization';
import { type Project } from '~/models/project';
import { insomniaFetch } from '~/ui/insomniaFetch';

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

interface RemoteFile {
  id: string;
  name: string;
  projectId: string;
  teamProjectId: string;
  organizationId: string;
}

export interface RemoteFilesLoaderResult {
  files: CommandRemoteItem<RemoteFile & { teamProjectLocalId: string; scope: 'unsynced' }>[];
}

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id: sessionId, accountId } = await userSession.get();

  if (!sessionId) {
    return {
      files: [],
    };
  }

  try {
    const remoteFiles = await insomniaFetch<RemoteFile[]>({
      method: 'GET',
      path: '/v1/user/files',
      sessionId,
    });

    const allOrganizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];

    const allRemoteFilesOrganizationIds = remoteFiles.map(file => file.organizationId);
    const allRemoteFilesProjectIds = remoteFiles.map(file => file.teamProjectId);

    const organizations = allOrganizations.filter(org => allRemoteFilesOrganizationIds.includes(org.id));

    const projects = await database.find<Project>(project.type, {
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

export function useRemoteFilesLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { load: fetcherLoad, ...fetcherRest } = useFetcher<typeof clientLoader>(args);

  const load = useCallback(() => {
    return fetcherLoad(href('/remote-files'));
  }, [fetcherLoad]);

  return {
    ...fetcherRest,
    load,
  };
}
