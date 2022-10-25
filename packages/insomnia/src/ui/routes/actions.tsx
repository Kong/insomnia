import { invariant } from '@remix-run/router';
import { ActionFunction, redirect } from 'react-router-dom';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import * as models from '../../models';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';

// Project
export const createNewProjectAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');
  const project = await models.project.create({ name });
  trackSegmentEvent(SegmentEvent.projectLocalCreate);
  return redirect(`/project/${project._id}`);
};

export const renameProjectAction: ActionFunction = async ({
  request,
  params,
}) => {
  const formData = await request.formData();
  const name = formData.get('name');

  invariant(typeof name === 'string', 'Name is required');

  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project ID is required');

  const project = await models.project.getById(projectId);

  if (!project) {
    throw new Error('Project not found');
  }

  if (isRemoteProject(project)) {
    throw new Error('Cannot rename remote project');
  }

  await models.project.update(project, { name });
};

export const deleteProjectAction: ActionFunction = async ({ params }) => {
  const { projectId } = params;
  invariant(typeof projectId === 'string', 'Project ID is required');
  const project = await models.project.getById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  await models.stats.incrementDeletedRequestsForDescendents(project);
  await models.project.remove(project);

  trackSegmentEvent(SegmentEvent.projectLocalDelete);
  return redirect(`/project/${DEFAULT_PROJECT_ID}`);
};
