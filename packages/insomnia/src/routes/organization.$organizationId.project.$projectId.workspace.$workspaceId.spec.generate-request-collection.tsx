import type { IRuleResult } from '@stoplight/spectral-core';
import { href, redirect } from 'react-router';

import { importResourcesToWorkspace, scanResources } from '~/common/import';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.generate-request-collection';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found');

  const apiSpec = await services.apiSpec.getByParentId(workspaceId);
  invariant(apiSpec, 'No API Specification was found');

  const workspace = await services.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await services.workspaceMeta.getOrCreateByParentId(workspaceId);

  const isLintError = (result: IRuleResult) => result.severity === 0;

  const gitRepositoryId = models.project.isConnectedGitProject(project)
    ? models.project.getEffectiveRepoId(project)
    : workspaceMeta?.gitRepositoryId;

  const rulesetPath = gitRepositoryId
    ? window.path.join(window.app.getPath('userData'), `version-control/git/${gitRepositoryId}/.spectral.yaml`)
    : '';

  const { diagnostics, error } = await window.main.lintSpec({ documentContent: apiSpec.contents, rulesetPath });
  if (error) {
    throw error;
  }
  const results = diagnostics?.filter(isLintError);
  if (apiSpec.contents && results && results.length) {
    throw new Error('Error Generating Configuration');
  }

  const scannedResources = await scanResources([
    {
      contentStr: apiSpec.contents,
    },
  ]);

  await importResourcesToWorkspace({
    workspaceId,
  });

  window.main.trackSegmentEvent({
    event: SegmentEvent.generateCollection,
    properties: {
      count_requests: scannedResources.map(r => r.requests?.length ?? 0).reduce((a, b) => a + b, 0),
    },
  });

  return redirect(
    href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
      organizationId,
      projectId,
      workspaceId,
    }),
  );
}

export const useSpecGenerateRequestCollectionActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec/generate-request-collection',
        {
          organizationId,
          projectId,
          workspaceId,
        },
      );

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
