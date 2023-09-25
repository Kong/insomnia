import type { IRuleResult } from '@stoplight/spectral-core';
import { generate, runTests, type Test } from 'insomnia-testing';
import path from 'path';
import { ActionFunction, redirect } from 'react-router-dom';

import * as session from '../../account/session';
import { parseApiSpec, resolveComponentSchemaRefs } from '../../common/api-specs';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, getAIServiceURL } from '../../common/constants';
import { database } from '../../common/database';
import { database as db } from '../../common/database';
import { importResourcesToWorkspace, scanResources } from '../../common/import';
import { generateId } from '../../common/misc';
import * as models from '../../models';
import { getById, update } from '../../models/helpers/request-operations';
import { isRequest, Request } from '../../models/request';
import { isRequestGroup, isRequestGroupId } from '../../models/request-group';
import { UnitTest } from '../../models/unit-test';
import { isCollection, Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { getSendRequestCallback } from '../../network/unit-test-feature';
import { initializeLocalBackendProjectAndMarkForSync } from '../../sync/vcs/initialize-backend-project';
import { getVCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

// Project
export const createNewProjectAction: ActionFunction = async ({ request, params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');
  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const sessionId = session.getCurrentSessionId();
  invariant(sessionId, 'User must be logged in to create a project');

  try {
    const newCloudProject = await window.main.insomniaFetch<{
      id: string;
      name: string;
    } | {
      error: string;
      message?: string;
    }>({
      path: `/v1/organizations/${organizationId}/team-projects`,
      method: 'POST',
      data: {
        name,
      },
      sessionId,
    });

    if (!newCloudProject || 'error' in newCloudProject) {
      let error = 'An unexpected error occurred while creating the project. Please try again.';
      if (newCloudProject.error === 'FORBIDDEN' || newCloudProject.error === 'NEEDS_TO_UPGRADE') {
        error = newCloudProject.error;
      }

      return {
        error,
      };
    }

    const project = await models.project.create({
      _id: newCloudProject.id,
      name: newCloudProject.name,
      remoteId: newCloudProject.id,
      parentId: organizationId,
    });

    return redirect(`/organization/${organizationId}/project/${project._id}`);
  } catch (err) {
    console.log(err);
    return {
      error: err instanceof Error ? err.message : `An unexpected error occurred while creating the project. Please try again. ${err}`,
    };
  }
};

export const renameProjectAction: ActionFunction = async ({
  request,
  params,
}) => {
  const formData = await request.formData();

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);

  invariant(project, 'Project not found');

  const sessionId = session.getCurrentSessionId();
  invariant(sessionId, 'User must be logged in to rename a project');

  try {
    const response = await window.main.insomniaFetch<void | {
      error: string;
      message?: string;
    }>({
      path: `/v1/organizations/${project.parentId}/team-projects/${project.remoteId}`,
      method: 'PATCH',
      sessionId,
      data: {
        name,
      },
    });

    if (response && 'error' in response) {
      return {
        error: response.error === 'FORBIDDEN' ? 'You do not have permission to rename this project.' : 'An unexpected error occurred while renaming the project. Please try again.',
      };
    }

    await models.project.update(project, { name });
    return null;
  } catch (err) {
    console.log(err);
    return {
      error: err instanceof Error ? err.message : `An unexpected error occurred while renaming the project. Please try again. ${err}`,
    };
  }
};

export const deleteProjectAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const sessionId = session.getCurrentSessionId();
  invariant(sessionId, 'User must be logged in to delete a project');

  try {
    const response = await window.main.insomniaFetch<void | {
      error: string;
      message?: string;
    }>({
      path: `/v1/organizations/${organizationId}/team-projects/${project.remoteId}`,
      method: 'DELETE',
      sessionId,
    });

    if (response && 'error' in response) {
      return {
        error: response.error === 'FORBIDDEN' ? 'You do not have permission to delete this project.' : 'An unexpected error occurred while deleting the project. Please try again.',
      };
    }

    await models.stats.incrementDeletedRequestsForDescendents(project);
    await models.project.remove(project);

    return redirect(`/organization/${organizationId}`);
  } catch (err) {
    console.log(err);
    return {
      error: err instanceof Error ? err.message : `An unexpected error occurred while deleting the project. Please try again. ${err}`,
    };
  }
};

// Workspace
export const createNewWorkspaceAction: ActionFunction = async ({
  params,
  request,
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

  if (scope === 'design') {
    await models.apiSpec.getOrCreateForParentId(workspace._id);
  }

  // Create default env, cookie jar, and meta
  await models.environment.getOrCreateForParentId(workspace._id);
  await models.cookieJar.getOrCreateForParentId(workspace._id);
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

  await database.flushChanges(flushId);
  if (session.isLoggedIn() && !workspaceMeta.gitRepositoryId) {
    const vcs = getVCS();
    if (vcs) {
      await initializeLocalBackendProjectAndMarkForSync({
        vcs,
        workspace,
      });
    }
  }

  window.main.trackSegmentEvent({
    event: isCollection(workspace)
      ? SegmentEvent.collectionCreate
      : SegmentEvent.documentCreate,
  });

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${workspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC
    }`
  );
};

export const deleteWorkspaceAction: ActionFunction = async ({
  params,
  request,
}) => {
  const { organizationId, projectId } = params;
  invariant(projectId, 'projectId is required');

  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');

  const formData = await request.formData();

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  await models.stats.incrementDeletedRequestsForDescendents(workspace);
  await models.workspace.remove(workspace);

  try {
    const vcs = getVCS();
    if (vcs) {
      const backendProject = await vcs._getBackendProjectByRootDocument(workspace._id);
      await vcs._removeProject(backendProject);

      console.log({ projectsLOCAL: await vcs.localBackendProjects() });
    }
  } catch (err) {
    console.warn('Failed to remove project from VCS', err);
  }
  console.log(`redirecting to /organization/${organizationId}/project/${projectId}`);
  return redirect(`/organization/${organizationId}/project/${projectId}`);
};

export const duplicateWorkspaceAction: ActionFunction = async ({ request, params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization Id is required');
  const formData = await request.formData();
  const projectId = formData.get('projectId');
  invariant(typeof projectId === 'string', 'Project ID is required');

  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const name = formData.get('name') || '';
  invariant(typeof name === 'string', 'Name is required');

  const duplicateToProject = await models.project.getById(projectId);
  invariant(duplicateToProject, 'Project not found');
  async function duplicate(
    workspace: Workspace,
    { name, parentId }: Pick<Workspace, 'name' | 'parentId'>,
  ) {
    const newWorkspace = await db.duplicate(workspace, {
      name,
      parentId,
    });
    await models.apiSpec.updateOrCreateForParentId(newWorkspace._id, {
      fileName: name,
    });
    models.stats.incrementCreatedRequestsForDescendents(newWorkspace);
    return newWorkspace;
  }
  const newWorkspace = await duplicate(workspace, {
    name,
    parentId: projectId,
  });

  // Create default env, cookie jar, and meta
  await models.environment.getOrCreateForParentId(newWorkspace._id);
  await models.cookieJar.getOrCreateForParentId(newWorkspace._id);
  await models.workspaceMeta.getOrCreateByParentId(newWorkspace._id);

  try {
    // Mark for sync if logged in and in the expected project
    const vcs = getVCS();
    if (session.isLoggedIn() && vcs) {
      await initializeLocalBackendProjectAndMarkForSync({
        vcs: vcs.newInstance(),
        workspace: newWorkspace,
      });
    }
  } catch (e) {
    console.warn('Failed to initialize local backend project', e);
  }

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${newWorkspace._id}/${newWorkspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC
    }`
  );
};

export const updateWorkspaceAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  const workspaceId = patch.workspaceId;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  if (workspace.scope === 'design') {
    const apiSpec = await models.apiSpec.getByParentId(workspaceId);
    invariant(apiSpec, 'No Api Spec found for this workspace');

    await models.apiSpec.update(apiSpec, {
      fileName: patch.name || workspace.name,
    });
  }

  await models.workspace.update(workspace, patch);

  return null;
};

export const updateWorkspaceMetaAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const patch = await request.json() as Partial<WorkspaceMeta>;
  await models.workspaceMeta.updateByParentId(workspaceId, patch);
  return null;
};

// Test Suite
export const createNewTestSuiteAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { organizationId, workspaceId, projectId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const unitTestSuite = await models.unitTestSuite.create({
    parentId: workspaceId,
    name,
  });

  window.main.trackSegmentEvent({ event: SegmentEvent.testSuiteCreate });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}`);
};

export const deleteTestSuiteAction: ActionFunction = async ({ params }) => {
  const { organizationId, workspaceId, projectId, testSuiteId } = params;
  invariant(typeof testSuiteId === 'string', 'Test Suite ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof projectId === 'string', 'Project ID is required');

  const unitTestSuite = await models.unitTestSuite.getById(testSuiteId);

  invariant(unitTestSuite, 'Test Suite not found');

  await models.unitTestSuite.remove(unitTestSuite);

  window.main.trackSegmentEvent({ event: SegmentEvent.testSuiteDelete });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test`);
};

export const runAllTestsAction: ActionFunction = async ({
  params,
}) => {
  const { organizationId, projectId, workspaceId, testSuiteId } = params;
  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof testSuiteId === 'string', 'Test Suite ID is required');

  const unitTests = await database.find<UnitTest>(models.unitTest.type, {
    parentId: testSuiteId,
  });
  invariant(unitTests, 'No unit tests found');

  const tests: Test[] = unitTests
    .filter(t => t !== null)
    .map(t => ({
      name: t.name,
      code: t.code,
      defaultRequestId: t.requestId,
    }));

  const src = generate([{ name: 'My Suite', suites: [], tests }]);

  const sendRequest = getSendRequestCallback();

  const results = await runTests(src, { sendRequest });

  const testResult = await models.unitTestResult.create({
    results,
    parentId: workspaceId,
  });

  window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRun });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`);
};

export const renameTestSuiteAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId, projectId, testSuiteId } = params;
  invariant(typeof testSuiteId === 'string', 'Test Suite ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof projectId === 'string', 'Project ID is required');

  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const unitTestSuite = await database.getWhere(models.unitTestSuite.type, {
    _id: testSuiteId,
  });

  invariant(unitTestSuite, 'Test Suite not found');

  await models.unitTestSuite.update(unitTestSuite, { name });

  return null;
};

// Unit Test
export const createNewTestAction: ActionFunction = async ({ request, params }) => {
  const { testSuiteId } = params;
  invariant(typeof testSuiteId === 'string', 'Test Suite ID is required');
  const formData = await request.formData();

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  await models.unitTest.create({
    parentId: testSuiteId,
    code: `const response1 = await insomnia.send();
expect(response1.status).to.equal(200);`,
    name,
  });

  window.main.trackSegmentEvent({ event: SegmentEvent.unitTestCreate });

  return null;
};

export const deleteTestAction: ActionFunction = async ({ params }) => {
  const { testId } = params;
  invariant(typeof testId === 'string', 'Test ID is required');

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
    _id: testId,
  });

  invariant(unitTest, 'Test not found');

  await models.unitTest.remove(unitTest);
  window.main.trackSegmentEvent({ event: SegmentEvent.unitTestDelete });

  return null;
};

export const updateTestAction: ActionFunction = async ({ request, params }) => {
  const { testId } = params;
  const formData = await request.formData();
  invariant(typeof testId === 'string', 'Test ID is required');
  const code = formData.get('code');
  invariant(typeof code === 'string', 'Code is required');
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');
  const requestId = formData.get('requestId');

  if (requestId) {
    invariant(typeof requestId === 'string', 'Request ID is required');
  }

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
    _id: testId,
  });
  invariant(unitTest, 'Test not found');

  await models.unitTest.update(unitTest, { name, code, requestId: requestId || null });

  return null;
};

export const runTestAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId, testSuiteId, testId } = params;
  invariant(typeof testId === 'string', 'Test ID is required');

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
    _id: testId,
  });
  invariant(unitTest, 'Test not found');

  const tests: Test[] = [
    {
      name: unitTest.name,
      code: unitTest.code,
      defaultRequestId: unitTest.requestId,
    },
  ];
  const src = generate([{ name: 'My Suite', suites: [], tests }]);

  const sendRequest = getSendRequestCallback();

  const results = await runTests(src, { sendRequest });

  const testResult = await models.unitTestResult.create({
    results,
    parentId: unitTest.parentId,
  });

  window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRun });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`);
};

// Api Spec
export const updateApiSpecAction: ActionFunction = async ({
  request,
  params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const formData = await request.formData();
  const contents = formData.get('contents');
  const fromSync = Boolean(formData.get('fromSync'));

  invariant(typeof contents === 'string', 'Contents is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  invariant(apiSpec, 'API Spec not found');
  await database.update({
    ...apiSpec,
    modified: Date.now(),
    created: fromSync ? Date.now() : apiSpec.created,
    contents,
  }, fromSync);

  return null;
};

export const generateCollectionFromApiSpecAction: ActionFunction = async ({
  params,
}) => {
  const { organizationId, projectId, workspaceId } = params;

  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  if (!apiSpec) {
    throw new Error('No API Specification was found');
  }

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);

  const isLintError = (result: IRuleResult) => result.severity === 0;
  const rulesetPath = path.join(
    process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
    `version-control/git/${workspaceMeta?.gitRepositoryId}/other/.spectral.yaml`,
  );

  const results = (await window.main.spectralRun({ contents: apiSpec.contents, rulesetPath })).filter(isLintError);
  if (apiSpec.contents && results && results.length) {
    throw new Error('Error Generating Configuration');
  }

  await scanResources({
    content: apiSpec.contents,
  });

  await importResourcesToWorkspace({
    workspaceId,
  });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_DEBUG}`);
};

export const generateCollectionAndTestsAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  invariant(apiSpec, 'API Spec not found');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);

  const isLintError = (result: IRuleResult) => result.severity === 0;
  const rulesetPath = path.join(
    process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
    `version-control/git/${workspaceMeta?.gitRepositoryId}/other/.spectral.yaml`,
  );

  const results = (await window.main.spectralRun({ contents: apiSpec.contents, rulesetPath })).filter(isLintError);
  if (apiSpec.contents && results && results.length) {
    throw new Error('Error Generating Configuration');
  }

  const resources = await scanResources({
    content: apiSpec.contents,
  });

  const aiGeneratedRequestGroup = await models.requestGroup.create({
    name: 'AI Generated Requests',
    parentId: workspaceId,
  });

  const requests = resources.requests?.filter(isRequest).map(request => {
    return {
      ...request,
      _id: generateId(models.request.prefix),
      parentId: aiGeneratedRequestGroup._id,
    };
  }) || [];

  await Promise.all(requests.map(request => models.request.create(request)));

  const aiTestSuite = await models.unitTestSuite.create({
    name: 'AI Generated Tests',
    parentId: workspaceId,
  });

  const spec = parseApiSpec(apiSpec.contents);

  const getMethodInfo = (request: Request) => {
    try {
      const specPaths = Object.keys(spec.contents?.paths) || [];

      const pathMatches = specPaths.filter(path => request.url.endsWith(path));

      const closestPath = pathMatches.sort((a, b) => {
        return a.length - b.length;
      })[0];

      const methodInfo = spec.contents?.paths[closestPath][request.method.toLowerCase()];

      return methodInfo;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  };

  const tests: Partial<UnitTest>[] = requests.map(request => {
    return {
      name: `Test: ${request.name}`,
      code: '',
      parentId: aiTestSuite._id,
      requestId: request._id,
    };
  });

  const total = tests.length;
  let progress = 0;

  // @TODO Investigate the defer API for streaming results.
  const progressStream = new TransformStream();
  const writer = progressStream.writable.getWriter();

  writer.write({
    progress,
    total,
  });

  for (const test of tests) {
    async function generateTest() {
      try {
        const request = requests.find(r => r._id === test.requestId);
        if (!request) {
          throw new Error('Request not found');
        }

        const methodInfo = resolveComponentSchemaRefs(spec, getMethodInfo(request));
        const response = await window.main.insomniaFetch<{ test: { requestId: string } }>({
          method: 'POST',
          origin: getAIServiceURL(),
          path: '/v1/generate-test',
          sessionId: session.getCurrentSessionId(),
          data: {
            teamId: organizationId,
            request: requests.find(r => r._id === test.requestId),
            methodInfo,
          },
        });

        const aiTest = response.test;

        await models.unitTest.create({ ...aiTest, parentId: aiTestSuite._id, requestId: test.requestId });
        writer.write({
          progress: ++progress,
          total,
        });

      } catch (err) {
        console.log(err);
        writer.write({
          progress: ++progress,
          total,
        });
      }
    }
    generateTest();
  }

  return progressStream;
};

export const generateTestsAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  invariant(apiSpec, 'API Spec not found');

  const workspace = await models.workspace.getById(workspaceId);

  invariant(workspace, 'Workspace not found');

  const workspaceDescendants = await database.withDescendants(workspace);

  const requests = workspaceDescendants.filter(isRequest);

  const aiTestSuite = await models.unitTestSuite.create({
    name: 'AI Generated Tests',
    parentId: workspaceId,
  });

  const tests: Partial<UnitTest>[] = requests.map(request => {
    return {
      name: `Test: ${request.name}`,
      code: '',
      parentId: aiTestSuite._id,
      requestId: request._id,
    };
  });

  const total = tests.length;
  let progress = 0;
  // @TODO Investigate the defer API for streaming results.
  const progressStream = new TransformStream();
  const writer = progressStream.writable.getWriter();

  writer.write({
    progress,
    total,
  });

  async function generateTests() {
    async function generateTest(test: Partial<UnitTest>) {
      try {
        const response = await window.main.insomniaFetch<{ test: { requestId: string } }>({
          method: 'POST',
          origin: getAIServiceURL(),
          path: '/v1/generate-test',
          sessionId: session.getCurrentSessionId(),
          data: {
            teamId: organizationId,
            request: requests.find(r => r._id === test.requestId),
          },
        });

        const aiTest = response.test;

        await models.unitTest.create({ ...aiTest, parentId: aiTestSuite._id, requestId: test.requestId });

        writer.write({
          progress: ++progress,
          total,
        });
      } catch (err) {
        console.log(err);
        writer.write({
          progress: ++progress,
          total,
        });
      }
    }

    for (const test of tests) {
      await generateTest(test);
    }
  }

  generateTests();

  return progressStream;
};

export const accessAIApiAction: ActionFunction = async ({ params }) => {
  const { organizationId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');

  try {
    const response = await window.main.insomniaFetch<{ enabled: boolean }>({
      method: 'POST',
      origin: getAIServiceURL(),
      path: '/v1/access',
      sessionId: session.getCurrentSessionId(),
      data: {
        teamId: organizationId,
      },
    });
    return {
      enabled: response.enabled,
    };
  } catch (err) {
    return { enabled: false };
  }
};

export const createEnvironmentAction: ActionFunction = async ({
  params,
  request,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const { isPrivate } = await request.json();

  const baseEnvironment = await models.environment.getByParentId(workspaceId);

  invariant(baseEnvironment, 'Base environment not found');

  const environment = await models.environment.create({
    parentId: baseEnvironment._id,
    isPrivate,
  });

  return environment;
};
export const updateEnvironment: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const { environmentId, patch } = await request.json();

  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const environment = await models.environment.getById(environmentId);

  invariant(environment, 'Environment not found');
  invariant(typeof name === 'string', 'Name is required');

  const baseEnvironment = await models.environment.getByParentId(workspaceId);

  invariant(baseEnvironment, 'Base environment not found');

  const updatedEnvironment = await models.environment.update(environment, patch);

  return updatedEnvironment;
};

export const deleteEnvironmentAction: ActionFunction = async ({
  request, params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');
  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const environment = await models.environment.getById(environmentId);

  const baseEnvironment = await models.environment.getByParentId(workspaceId);

  invariant(environment?._id !== baseEnvironment?._id, 'Cannot delete base environment');

  invariant(environment, 'Environment not found');

  await models.environment.remove(environment);

  return null;
};

export const duplicateEnvironmentAction: ActionFunction = async ({
  request, params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');

  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const environment = await models.environment.getById(environmentId);
  invariant(environment, 'Environment not found');

  const newEnvironment = await models.environment.duplicate(environment);

  return newEnvironment;
};

export const setActiveEnvironmentAction: ActionFunction = async ({
  request, params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');

  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);

  invariant(workspaceMeta, 'Workspace meta not found');

  await models.workspaceMeta.update(workspaceMeta, { activeEnvironmentId: environmentId || null });

  return null;
};

export const updateCookieJarAction: ActionFunction = async ({
  request, params,
}) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const { cookieJarId, patch } = await request.json();

  invariant(typeof cookieJarId === 'string', 'Cookie Jar ID is required');

  const cookieJar = await models.cookieJar.getById(cookieJarId);

  invariant(cookieJar, 'Cookie Jar not found');

  const updatedCookieJar = await models.cookieJar.update(cookieJar, patch);

  return updatedCookieJar;
};

export const createNewCaCertificateAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  await models.caCertificate.create(patch);
  return null;
};

export const updateCaCertificateAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  const caCertificate = await models.caCertificate.getById(patch._id);
  invariant(caCertificate, 'CA Certificate not found');
  await models.caCertificate.update(caCertificate, patch);
  return null;
};

export const deleteCaCertificateAction: ActionFunction = async ({ params }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const caCertificate = await models.caCertificate.findByParentId(workspaceId);
  invariant(caCertificate, 'CA Certificate not found');
  await models.caCertificate.removeWhere(workspaceId);
  return null;
};

export const createNewClientCertificateAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  await models.clientCertificate.create(patch);
  return null;
};

export const updateClientCertificateAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  const clientCertificate = await models.clientCertificate.getById(patch._id);
  invariant(clientCertificate, 'CA Certificate not found');
  await models.clientCertificate.update(clientCertificate, patch);
  return null;
};

export const deleteClientCertificateAction: ActionFunction = async ({ request }) => {
  const { _id } = await request.json();
  const clientCertificate = await models.clientCertificate.getById(_id);
  invariant(clientCertificate, 'CA Certificate not found');
  await models.clientCertificate.remove(clientCertificate);
  return null;
};

export const updateSettingsAction: ActionFunction = async ({ request }) => {
  const patch = await request.json();
  await models.settings.patch(patch);
  return null;
};

const getCollectionItem = async (id: string) => {
  let item;
  if (isRequestGroupId(id)) {
    item = await models.requestGroup.getById(id);
  } else {
    item = await getById(id);
  }

  invariant(item, 'Item not found');

  return item;
};

export const reorderCollectionAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId }  = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const { id, targetId, dropPosition, metaSortKey } = await request.json();
  invariant(typeof id === 'string', 'ID is required');
  invariant(typeof targetId === 'string', 'Target ID is required');
  invariant(typeof dropPosition === 'string', 'Drop position is required');
  invariant(typeof metaSortKey === 'number', 'MetaSortKey position is required');

  if (id === targetId) {
    return null;
  }

  const item = await getCollectionItem(id);
  const targetItem = await getCollectionItem(targetId);

  const parentId = dropPosition === 'after' && isRequestGroup(targetItem) ? targetItem._id : targetItem.parentId;

  if (isRequestGroup(item)) {
    await models.requestGroup.update(item, { parentId, metaSortKey });
  } else {
    await update(item, { parentId, metaSortKey });
  }

  return null;
};
