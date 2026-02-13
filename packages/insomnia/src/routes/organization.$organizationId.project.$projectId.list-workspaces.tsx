import { href } from 'react-router';

import { parseApiSpec, type ParsedApiSpec } from '~/common/api-specs';
import { database } from '~/common/database';
import { scopeToLabelMap } from '~/common/get-workspace-label';
import { isNotNullOrUndefined } from '~/common/misc';
import { descendingNumberSort } from '~/common/sorting';
import * as models from '~/models';
import { type ApiSpec } from '~/models/api-spec';
import type { GitRepository } from '~/models/git-repository';
import { sortProjects } from '~/models/helpers/project';
import type { MockServer } from '~/models/mock-server';
import { type Project } from '~/models/project';
import { isDesign } from '~/models/workspace';
import type { WorkspaceMeta } from '~/models/workspace-meta';
import { invariant } from '~/utils/invariant';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.list-workspaces';
import { type InsomniaFile } from './organization.$organizationId.project.$projectId._index';

async function getAllLocalFiles({ projectId }: { projectId: string }) {
  const projectWorkspaces = await models.workspace.findByParentId(projectId);
  const [workspaceMetas, apiSpecs, mockServers] = await Promise.all([
    database.find<WorkspaceMeta>(models.workspaceMeta.type, {
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
    database.find<ApiSpec>(models.apiSpec.type, {
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
    database.find<MockServer>(models.mockServer.type, {
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
  ]);

  const gitRepositories = await database.find<GitRepository>(models.gitRepository.type, {
    parentId: {
      $in: workspaceMetas.map(wm => wm.gitRepositoryId).filter(isNotNullOrUndefined),
    },
  });

  const files: InsomniaFile[] = projectWorkspaces.map(workspace => {
    const apiSpec = apiSpecs.find(spec => spec.parentId === workspace._id);
    const mockServer = mockServers.find(mock => mock.parentId === workspace._id);
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
    const workspaceMeta = workspaceMetas.find(wm => wm.parentId === workspace._id);
    const gitRepository = gitRepositories.find(gr => gr._id === workspaceMeta?.gitRepositoryId);

    const lastActiveBranch = gitRepository?.cachedGitRepositoryBranch;

    const lastCommitAuthor = gitRepository?.cachedGitLastAuthor;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta?.modified || workspace.modified;

    const modifiedLocally = isDesign(workspace) ? apiSpec?.modified || 0 : workspaceModified;

    // Span spec, workspace and sync related timestamps for card last modified label and sort order
    const lastModifiedFrom = [
      workspace?.modified,
      workspaceMeta?.modified,
      modifiedLocally,
      gitRepository?.cachedGitLastCommitTime,
    ];

    const lastModifiedTimestamp = lastModifiedFrom.filter(isNotNullOrUndefined).sort(descendingNumberSort)[0];

    const hasUnsavedChanges = Boolean(
      isDesign(workspace) &&
        gitRepository?.cachedGitLastCommitTime &&
        modifiedLocally > gitRepository?.cachedGitLastCommitTime,
    );

    const specVersion = spec?.info?.version ? String(spec?.info?.version) : '';

    return {
      id: workspace._id,
      name: workspace.name,
      scope: workspace.scope,
      label: scopeToLabelMap[workspace.scope],
      created: workspace.created,
      lastModifiedTimestamp:
        (hasUnsavedChanges && modifiedLocally) || gitRepository?.cachedGitLastCommitTime || lastModifiedTimestamp,
      branch: lastActiveBranch || '',
      lastCommit:
        hasUnsavedChanges && gitRepository?.cachedGitLastCommitTime && lastCommitAuthor ? `by ${lastCommitAuthor}` : '',
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
  return files;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;

  const project = await models.project.getById(projectId);
  invariant(project, `Project was not found ${projectId}`);
  const organizationProjects =
    (await database.find<Project>(models.project.type, {
      parentId: organizationId,
    })) || [];

  const projects = sortProjects(organizationProjects);
  const files = await getAllLocalFiles({ projectId });

  return {
    files,
    activeProject: project,
    projects,
  };
}

export const useProjectListWorkspacesLoaderFetcher = createFetcherLoadHook(
  load =>
    ({ organizationId, projectId }: { organizationId: string; projectId: string }) => {
      return load(
        href('/organization/:organizationId/project/:projectId/list-workspaces', {
          organizationId,
          projectId,
        }),
      );
    },
  clientLoader,
);
