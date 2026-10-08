import { services } from 'insomnia-data';
import { href } from 'react-router';

import { database } from '~/common/database';
import { invariant } from '~/common/utils/invariant';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.update';
import { generateRequestCollection } from './organization.$organizationId.project.$projectId.workspace.$workspaceId.spec.generate-request-collection';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { projectId, workspaceId } = params;

  const formData = await request.formData();
  const contents = formData.get('contents');
  const fromTemplate = Boolean(formData.get('fromTemplate'));
  const shouldGenerateRequestCollection = Boolean(formData.get('generateRequestCollection'));

  invariant(typeof contents === 'string', 'Contents is required');

  // Create the spec if it doesn't exist yet, otherwise update the existing one
  const apiSpec = await services.apiSpec.getOrCreateForParentId(workspaceId);

  await database.update({
    ...apiSpec,
    modified: Date.now(),
    created: fromTemplate ? Date.now() : apiSpec.created,
    contents,
  });

  if (shouldGenerateRequestCollection) {
    try {
      await generateRequestCollection({ projectId, workspaceId });
    } catch (error) {
      console.error('Error generating requests from spec:', error);
    }
  }

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
      generateRequestCollection = false,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      contents: string;
      fromTemplate?: boolean;
      generateRequestCollection?: boolean;
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
      if (generateRequestCollection) {
        formData.append('generateRequestCollection', 'true');
      }

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
);
