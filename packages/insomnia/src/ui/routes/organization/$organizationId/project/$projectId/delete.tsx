import * as models from '@insomnia/models';
import { DEFAULT_ORGANIZATION_ID } from '@insomnia/models/organization';
import { DEFAULT_PROJECT_ID } from '@insomnia/models/project';
import { SegmentEvent, trackSegmentEvent } from '@insomnia/ui/analytics';
import { invariant } from '@remix-run/router';
import { ActionFunction, redirect } from 'react-router-dom';

export const deleteProjectAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  await models.stats.incrementDeletedRequestsForDescendents(project);
  await models.project.remove(project);

  trackSegmentEvent(SegmentEvent.projectLocalDelete);

  return redirect(`/organization/${DEFAULT_ORGANIZATION_ID}/project/${DEFAULT_PROJECT_ID}`);
};
