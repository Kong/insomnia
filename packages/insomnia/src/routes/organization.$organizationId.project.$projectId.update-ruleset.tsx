import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.update-ruleset';

interface UpdateProjectRulesetInputData {
  rulesetContent: string;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId } = params;

  const project = await services.project.get(projectId);
  invariant(project, 'Project not found');

  const { rulesetContent } = (await request.json()) as UpdateProjectRulesetInputData;
  invariant(typeof rulesetContent === 'string', 'Ruleset content is required');

  await services.projectLintRuleset.upsert(projectId, { rulesetContent });

  return null;
}

export const useUpdateProjectRulesetActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      rulesetContent,
    }: {
      organizationId: string;
      projectId: string;
      rulesetContent: string;
    }) => {
      return submit(JSON.stringify({ rulesetContent }), {
        action: href('/organization/:organizationId/project/:projectId/update-ruleset', {
          organizationId,
          projectId,
        }),
        method: 'POST',
        encType: 'application/json',
      });
    },
);
