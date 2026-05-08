import { href } from 'react-router';

import { database } from '~/common/database';
import { services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const { contents, fromTemplate, rulesetContent } = (await request.json()) as {
    contents?: string;
    fromTemplate?: boolean;
    rulesetContent?: string | null;
  };

  const apiSpec = await services.apiSpec.getByParentId(workspaceId);
  invariant(apiSpec, 'API Spec not found');

  await database.update({
    ...apiSpec,
    modified: Date.now(),
    created: fromTemplate ? Date.now() : apiSpec.created,
    ...(contents !== undefined && { contents }),
    ...(rulesetContent !== undefined && { rulesetContent: rulesetContent ?? undefined }),
  });

  return null;
}

export const useSpecUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      contents,
      fromTemplate = false,
      rulesetContent,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      contents?: string;
      fromTemplate?: boolean;
      rulesetContent?: string | null;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec/update', {
        organizationId,
        projectId,
        workspaceId,
      });

      return submit(JSON.stringify({ contents, fromTemplate, rulesetContent }), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
