import { href, redirect } from 'react-router';

import { services } from '~/insomnia-data';
import * as models from '~/models';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { pullBackendProject } from '~/sync/vcs/pull-backend-project';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.insomnia-sync.pull-remote-file';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId } = params;

  try {
    const formData = await request.formData();

    const backendProjectId = formData.get('backendProjectId');
    invariant(typeof backendProjectId === 'string', 'Collection Id is required');
    const remoteId = formData.get('remoteId');
    invariant(typeof remoteId === 'string', 'Remote Id is required');

    const vcs = VCSInstance();

    const remoteBackendProjects = await vcs.remoteBackendProjects({
      teamId: organizationId,
      teamProjectId: remoteId,
    });

    const backendProject = remoteBackendProjects.find(p => p.id === backendProjectId);

    invariant(backendProject, 'Backend project not found');

    const project = await models.project.getByRemoteId(remoteId);

    invariant(project?.remoteId, 'Project is not a remote project');

    // Clone old VCS so we don't mess anything up while working on other backend projects
    const newVCS = vcs.newInstance();
    // Remove all backend projects for workspace first
    await newVCS.removeBackendProjectsForRoot(backendProject.rootDocumentId);

    const { workspaceId } = await pullBackendProject({
      vcs: newVCS,
      backendProject,
      remoteProject: project,
    });

    const workspace = await services.workspace.getById(workspaceId);

    invariant(workspace, 'Workspace not found');
    const activity = models.workspace.scopeToActivity(workspace?.scope);

    return redirect(`/organization/${organizationId}/project/${project._id}/workspace/${workspaceId}/${activity}`);
  } catch (e) {
    console.warn('Failed to pull remote collection', e);
    return {
      error: 'Failed to pull remote collection',
    };
  }
}

export const useInsomniaSyncPullRemoteFileActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      backendProjectId,
      remoteId,
    }: {
      organizationId: string;
      backendProjectId: string;
      remoteId: string;
    }) => {
      const url = href('/organization/:organizationId/insomnia-sync/pull-remote-file', {
        organizationId,
      });

      const formData = new FormData();
      formData.set('backendProjectId', backendProjectId);
      formData.set('remoteId', remoteId);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
