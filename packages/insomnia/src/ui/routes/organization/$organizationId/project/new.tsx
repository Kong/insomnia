import * as models from '@insomnia/models';
import { SegmentEvent, trackSegmentEvent } from '@insomnia/ui/analytics';
import { invariant } from '@remix-run/router';
import { ActionFunction, redirect } from 'react-router-dom';

export const action: ActionFunction = async ({ request, params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');
  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');
  const project = await models.project.create({ name });
  trackSegmentEvent(SegmentEvent.projectLocalCreate);
  return redirect(`/organization/${organizationId}/project/${project._id}`);
};
