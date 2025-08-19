import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { workspaceId } = params;

  const formData = await request.formData();
  const contents = formData.get('contents');
  const fromSync = Boolean(formData.get('fromSync'));

  invariant(typeof contents === 'string', 'Contents is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  invariant(apiSpec, 'API Spec not found');
  await database.update(
    {
      ...apiSpec,
      modified: Date.now(),
      created: fromSync ? Date.now() : apiSpec.created,
      contents,
    },
    fromSync,
  );

  return null;
}

export function useSpecUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      contents,
      fromSync = false,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      contents: string;
      fromSync?: boolean;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec/update', {
        organizationId,
        projectId,
        workspaceId,
      });

      const formData = new FormData();
      formData.append('contents', contents);
      if (fromSync) {
        formData.append('fromSync', 'true');
      }

      return fetcherSubmit(formData, {
        action: url,
        method: 'POST',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
