import * as models from '@insomnia/models';
import { isRemoteProject } from '@insomnia/models/project';
import { invariant } from '@remix-run/router';
import {
  LoaderFunction,
  redirect,
} from 'react-router-dom';

export const loader: LoaderFunction = async ({ params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  if (models.organization.DEFAULT_ORGANIZATION_ID === organizationId) {
    const localProjects = (await models.project.all()).filter(proj => !isRemoteProject(proj));
    if (localProjects[0]._id) {
      return redirect(`/organization/${organizationId}/project/${localProjects[0]._id}`);
    }
  } else {
    const projectId = organizationId;
    return redirect(`/organization/${organizationId}/project/${projectId}`);
  }

  return;
};
