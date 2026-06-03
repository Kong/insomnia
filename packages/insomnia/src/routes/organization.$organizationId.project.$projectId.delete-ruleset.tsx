import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.delete-ruleset';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { projectId } = params;

  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');

  await services.projectLintRuleset.remove(projectId);

  return null;
}

export const useDeleteProjectRulesetActionFetcher = createFetcherSubmitHook(
  submit =>
    ({ organizationId, projectId }: { organizationId: string; projectId: string }) => {
      return submit(null, {
        action: href('/organization/:organizationId/project/:projectId/delete-ruleset', {
          organizationId,
          projectId,
        }),
        method: 'POST',
      });
    },
);
