import path from 'node:path';

import type { IRuleResult } from '@stoplight/spectral-core';
import { type ActionFunctionArgs, redirect } from 'react-router';

import { importResourcesToWorkspace, scanResources } from '../../common/import';
import * as models from '../../models';
import { isGitProject } from '../../models/project';
import { invariant } from '../../utils/invariant';

export async function action({ params }: ActionFunctionArgs) {
  const { organizationId, projectId, workspaceId } = params;

  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);
  invariant(apiSpec, 'No API Specification was found');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);

  const isLintError = (result: IRuleResult) => result.severity === 0;

  const gitRepositoryId = isGitProject(project) ? project.gitRepositoryId : workspaceMeta?.gitRepositoryId;

  const rulesetPath = gitRepositoryId
    ? path.join(window.app.getPath('userData'), `version-control/git/${gitRepositoryId}/other/.spectral.yaml`)
    : '';

  const { diagnostics, error } = await window.main.lintSpec({ documentContent: apiSpec.contents, rulesetPath });
  if (error) {
    throw error;
  }
  const results = diagnostics?.filter(isLintError);
  if (apiSpec.contents && results && results.length) {
    throw new Error('Error Generating Configuration');
  }

  await scanResources([
    {
      contentStr: apiSpec.contents,
    },
  ]);

  await importResourcesToWorkspace({
    workspaceId,
  });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`);
}
