import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.refresh-ruleset';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { projectId } = params;

  const project = await services.project.getById(projectId);
  invariant(project, 'Project not found');

  // Touch the record so `modified` reflects when the ruleset was last recompiled.
  await services.projectLintRuleset.upsert(projectId, {});

  return null;
}

export const useRefreshProjectRulesetActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId, projectId }: { organizationId: string; projectId: string }) => {
      return submit(null, {
        action: href('/organization/:organizationId/project/:projectId/refresh-ruleset', {
          organizationId,
          projectId,
        }),
        method: 'POST',
      });
    },
);
