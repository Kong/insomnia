import { href } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();
  const contents = formData.get('contents');
  const fromTemplate = Boolean(formData.get('fromTemplate'));

  invariant(typeof contents === 'string', 'Contents is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  invariant(apiSpec, 'API Spec not found');
  await database.update({
    ...apiSpec,
    modified: Date.now(),
    created: fromTemplate ? Date.now() : apiSpec.created,
    contents,
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
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      contents: string;
      fromTemplate?: boolean;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec/update', {
        organizationId,
        projectId,
        workspaceId,
      });

      const formData = new FormData();
      formData.append('contents', contents);
      if (fromTemplate) {
        formData.append('fromTemplate', 'true');
      }

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
);
