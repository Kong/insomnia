import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { Workspace, WorkspaceMeta } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { useCallback } from 'react';

import { parseApiSpec, type ParsedApiSpec } from '~/common/api-specs';
import { scopeToLabelMap } from '~/common/get-workspace-label';
import { isNotNullOrUndefined } from '~/common/misc';
import { type InsomniaFile } from '~/common/project';
import { descendingNumberSort } from '~/common/sorting';

import {
  type DesignWorkspaceChildren,
  type MockServerWorkspaceChildren,
  useWorkspaceChildrenByWorkspaceIds,
} from './workspace-children';

export const workspaceKeys = {
  all: ['workspaces'],
  // all workspace details under a project
  details: (projectId: string) => [...workspaceKeys.all, 'details', projectId],
  // a single workspace detail, scoped under its parent project
  detail: (workspaceId: string, projectId: string) => [...workspaceKeys.details(projectId), workspaceId],
};

export const getWorkspacesByProjectId = (projectId: string): Promise<Workspace[]> =>
  services.workspace.findByParentId(projectId);

export const getWorkspaceById = async (workspaceId: string): Promise<Workspace | undefined> =>
  await services.workspace.getById(workspaceId);

// All workspace details under a project.
export const useWorkspaces = (projectId: string): UseQueryResult<Workspace[]> =>
  useQuery({
    queryKey: workspaceKeys.details(projectId),
    queryFn: () => getWorkspacesByProjectId(projectId),
  });
export const useWorkspace = (workspaceId: string, projectId: string): UseQueryResult<Workspace | undefined> =>
  useQuery({
    queryKey: workspaceKeys.detail(projectId, workspaceId),
    queryFn: () => getWorkspaceById(workspaceId),
  });
export const useWorkspacesByProjectIds = (projectIds: string[]) =>
  useQueries({
    queries: projectIds.map(projectId => ({
      queryKey: workspaceKeys.details(projectId),
      queryFn: async () => await getWorkspacesByProjectId(projectId),
    })),
    combine: useCallback(
      (results: UseQueryResult<Workspace[]>[]) => {
        const map = new Map<string, Workspace[]>();
        projectIds.forEach((projectId, index) => map.set(projectId, results[index]?.data ?? []));
        return map;
      },
      [projectIds],
    ),
  });

export const useLocalFiles = (projectId: string, workspaceMetas: WorkspaceMeta[]): InsomniaFile[] => {
  const workspacesByProjectId = useWorkspacesByProjectIds([projectId]);
  const workspaces = workspacesByProjectId.get(projectId) ?? [];
  const designWorkspaceIds = workspaces
    .filter(workspace => workspace.scope === 'design')
    .map(workspace => workspace._id);
  const mockServerWorkspaceIds = workspaces
    .filter(workspace => workspace.scope === 'mock-server')
    .map(workspace => workspace._id);

  const designChildrenByWorkspaceId = useWorkspaceChildrenByWorkspaceIds(designWorkspaceIds, 'design');
  const mockServerChildrenByWorkspaceId = useWorkspaceChildrenByWorkspaceIds(mockServerWorkspaceIds, 'mock-server');

  return workspaces.map(workspace => {
    const apiSpec = (designChildrenByWorkspaceId.get(workspace._id) as DesignWorkspaceChildren)?.children.apiSpec;
    const mockServer = (mockServerChildrenByWorkspaceId.get(workspace._id) as MockServerWorkspaceChildren)?.children
      .mockServer;

    let spec: ParsedApiSpec['contents'] = null;
    let specFormat: ParsedApiSpec['format'] = null;
    let specFormatVersion: ParsedApiSpec['formatVersion'] = null;
    if (apiSpec) {
      try {
        const result = parseApiSpec(apiSpec.contents);
        spec = result.contents;
        specFormat = result.format;
        specFormatVersion = result.formatVersion;
      } catch {
        // Assume there is no spec
        // TODO: Check for parse errors if it's an invalid spec
      }
    }

    const workspaceMeta = workspaceMetas?.find(wm => wm.parentId === workspace._id);

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta?.modified || workspace.modified;

    const modifiedLocally = models.workspace.isDesign(workspace) ? apiSpec?.modified || 0 : workspaceModified;

    // Span spec, workspace and sync related timestamps for card last modified label and sort order
    const lastModifiedFrom = [workspace?.modified, workspaceMeta?.modified, modifiedLocally];

    const lastModifiedTimestamp = lastModifiedFrom.filter(isNotNullOrUndefined).sort(descendingNumberSort)[0];

    const specVersion = spec?.info?.version ? String(spec?.info?.version) : '';

    return {
      id: workspace._id,
      name: workspace.name,
      scope: workspace.scope,
      label: scopeToLabelMap[workspace.scope],
      created: workspace.created,
      lastModifiedTimestamp: lastModifiedTimestamp,
      branch: '',
      lastCommit: '',
      version: specVersion ? `${specVersion?.startsWith('v') ? '' : 'v'}${specVersion}` : '',
      oasFormat: specFormat ? `${specFormat === 'openapi' ? 'OpenAPI' : 'Swagger'} ${specFormatVersion || ''}` : '',
      mockServer,
      apiSpec,
      workspace,
      hasUncommittedChanges: workspaceMeta?.hasUncommittedChanges,
      hasUnpushedChanges: workspaceMeta?.hasUnpushedChanges,
      gitFilePath: workspaceMeta?.gitFilePath,
    };
  });
};
