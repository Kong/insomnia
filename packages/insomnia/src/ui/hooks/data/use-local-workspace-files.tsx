import type { GitRepository, WorkspaceMeta } from 'insomnia-data';
import { database, models } from 'insomnia-data';
import { useEffect, useState } from 'react';

import { parseApiSpec, type ParsedApiSpec } from '~/common/api-specs';
import { scopeToLabelMap } from '~/common/get-workspace-label';
import { isNotNullOrUndefined } from '~/common/misc';
import { type InsomniaFile } from '~/common/project';
import { descendingNumberSort } from '~/common/sorting';
import { useOrganizationData } from '~/ui/hooks/data/use-organization-data';

import { useWorkspaceChildrenByWorkspaceIds } from './use-workspace-children';

export const useLocalFiles = ({ organizationId, projectId }: { organizationId: string; projectId: string }) => {
  const [insomniaFiles, setInsomniaFiles] = useState<InsomniaFile[]>([]);
  const { workspaces } = useOrganizationData(organizationId);
  const projectWorkspaces = workspaces.filter(w => w.parentId === projectId);
  const apiSpecWorkspaces = projectWorkspaces.filter(w => w.scope === 'design');
  const mockServerWorkspaces = projectWorkspaces.filter(w => w.scope === 'mock-server');
  const designChildrenByWorkspaceId = useWorkspaceChildrenByWorkspaceIds(
    apiSpecWorkspaces.map(w => w._id),
    'design',
  );
  const mockServerChildrenByWorkspaceId = useWorkspaceChildrenByWorkspaceIds(
    mockServerWorkspaces.map(w => w._id),
    'mock-server',
  );
  const apiSpecs = Array.from(designChildrenByWorkspaceId.values())
    .flatMap(data => data.children.apiSpec)
    .filter(isNotNullOrUndefined);
  const mockServers = Array.from(mockServerChildrenByWorkspaceId.values()).flatMap(data => data.children.mockServer);

  useEffect(() => {
    const getLocalFiles = async () => {
      const workspaceMetas = await database.find<WorkspaceMeta>(models.workspaceMeta.type, {
        parentId: {
          $in: projectWorkspaces.map(w => w._id),
        },
      });
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

        const modifiedLocally = models.workspace.isDesign(workspace) ? apiSpec?.modified || 0 : workspaceModified;

        // Span spec, workspace and sync related timestamps for card last modified label and sort order
        const lastModifiedFrom = [
          workspace?.modified,
          workspaceMeta?.modified,
          modifiedLocally,
          gitRepository?.cachedGitLastCommitTime,
        ];

        const lastModifiedTimestamp = lastModifiedFrom.filter(isNotNullOrUndefined).sort(descendingNumberSort)[0];

        const hasUnsavedChanges = Boolean(
          models.workspace.isDesign(workspace) &&
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
            hasUnsavedChanges && gitRepository?.cachedGitLastCommitTime && lastCommitAuthor
              ? `by ${lastCommitAuthor}`
              : '',
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
      setInsomniaFiles(files);
    };
    getLocalFiles();
  }, [apiSpecs, mockServers, projectId, projectWorkspaces]);

  return insomniaFiles;
};
