import * as session from '@insomnia/account/session';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '@insomnia/common/constants';
import { database } from '@insomnia/common/database';
import * as models from '@insomnia/models';
import { isRemoteProject } from '@insomnia/models/project';
import { isCollection } from '@insomnia/models/workspace';
import { initializeLocalBackendProjectAndMarkForSync } from '@insomnia/sync/vcs/initialize-backend-project';
import { getVCS } from '@insomnia/sync/vcs/vcs';
import { SegmentEvent, trackSegmentEvent } from '@insomnia/ui/analytics';
import { invariant } from '@remix-run/router';
import { ActionFunction, redirect } from 'react-router-dom';

// Workspace

export const createNewWorkspaceAction: ActionFunction = async ({
  params, request,
}) => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);

  invariant(project, 'Project not found');

  const formData = await request.formData();

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const scope = formData.get('scope');
  invariant(scope === 'design' || scope === 'collection', 'Scope is required');

  const flushId = await database.bufferChanges();

  const workspace = await models.workspace.create({
    name,
    scope,
    parentId: projectId,
  });
  await models.workspace.ensureChildren(workspace);
  await models.workspaceMeta.getOrCreateByParentId(workspace._id);

  await database.flushChanges(flushId);
  if (session.isLoggedIn() && isRemoteProject(project) && isCollection(workspace)) {
    const vcs = getVCS();
    if (vcs) {
      initializeLocalBackendProjectAndMarkForSync({
        vcs,
        workspace,
      });
    }
  }

  trackSegmentEvent(
    isCollection(workspace)
      ? SegmentEvent.collectionCreate
      : SegmentEvent.documentCreate
  );

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${workspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC}`
  );
};
