import { database } from '@insomnia/common/database';
import * as models from '@insomnia/models';
import { RemoteProject } from '@insomnia/models/project';
import { pullBackendProject } from '@insomnia/sync/vcs/pull-backend-project';
import { getVCS } from '@insomnia/sync/vcs/vcs';
import { invariant } from '@remix-run/router';
import { ActionFunction } from 'react-router-dom';

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const backendProjectId = formData.get('backendProjectId');
  invariant(typeof backendProjectId === 'string', 'Collection Id is required');
  const remoteId = formData.get('remoteId');
  invariant(typeof remoteId === 'string', 'Remote Id is required');

  const vcs = getVCS();
  invariant(vcs, 'VCS is not defined');

  const remoteBackendProjects = await vcs.remoteBackendProjects(remoteId);
  const backendProject = remoteBackendProjects.find(p => p.id === backendProjectId);

  invariant(backendProject, 'Backend project not found');

  const remoteProjects = await database.find<RemoteProject>(models.project.type, {
    // @ts-expect-error -- Improve database query typing
    $not: {
      remoteId: null,
    },
  });

  // Clone old VCS so we don't mess anything up while working on other backend projects
  const newVCS = vcs.newInstance();
  // Remove all backend projects for workspace first
  await newVCS.removeBackendProjectsForRoot(backendProject.rootDocumentId);

  await pullBackendProject({ vcs: newVCS, backendProject, remoteProjects });
};
