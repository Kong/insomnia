import type { IRuleResult } from '@stoplight/spectral-core';
import { generate, runTests, Test } from 'insomnia-testing';
import path from 'path';
import { ActionFunction, redirect } from 'react-router-dom';

import * as session from '../../account/session';
import { parseApiSpec, resolveComponentSchemaRefs } from '../../common/api-specs';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../common/constants';
import { database } from '../../common/database';
import { importResourcesToWorkspace, scanResources } from '../../common/import';
import { generateId } from '../../common/misc';
import * as models from '../../models';
import * as workspaceOperations from '../../models/helpers/workspace-operations';
import { DEFAULT_ORGANIZATION_ID } from '../../models/organization';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';
import { isRequest, Request } from '../../models/request';
import { UnitTest } from '../../models/unit-test';
import { isCollection } from '../../models/workspace';
import { axiosRequest } from '../../network/axios-request';
import { getSendRequestCallback } from '../../network/unit-test-feature';
import { initializeLocalBackendProjectAndMarkForSync } from '../../sync/vcs/initialize-backend-project';
import { getVCS } from '../../sync/vcs/vcs';
import { invariant } from '../../utils/invariant';
import { SegmentEvent, trackSegmentEvent } from '../analytics';

// Project
export const createNewProjectAction: ActionFunction = async ({ request, params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');
  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');
  const project = await models.project.create({ name });
  trackSegmentEvent(SegmentEvent.projectLocalCreate);
  return redirect(`/organization/${organizationId}/project/${project._id}`);
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

  invariant(
    !isRemoteProject(project),
    'Cannot rename remote project',
  );

  await models.project.update(project, { name });

  return null;
};

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

  const newWorkspace = await workspaceOperations.duplicate(workspace, {
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
    if (session.isLoggedIn() && vcs && isRemoteProject(duplicateToProject)) {
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
  const formData = await request.formData();
  const workspaceId = formData.get('workspaceId');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const description = formData.get('description');
  if (description) {
    invariant(typeof description === 'string', 'Description is required');
  }

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  if (workspace.scope === 'design') {
    const apiSpec = await models.apiSpec.getByParentId(workspaceId);
    invariant(apiSpec, 'No Api Spec found for this workspace');

    await models.apiSpec.update(apiSpec, {
      fileName: name,
    });
  }

  await models.workspace.update(workspace, {
    name,
    description: description || workspace.description,
  });

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

  trackSegmentEvent(SegmentEvent.testSuiteCreate);

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

  trackSegmentEvent(SegmentEvent.testSuiteDelete);

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
  console.log('unitTests', unitTests);

  const tests: Test[] = unitTests
    .filter(t => t !== null)
    .map(t => ({
      name: t.name,
      code: t.code,
      defaultRequestId: t.requestId,
    }));

  const src = generate([{ name: 'My Suite', suites: [], tests }]);

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(
    workspaceId
  );

  const sendRequest = getSendRequestCallback(
    workspaceMeta?.activeEnvironmentId || undefined
  );

  const results = await runTests(src, { sendRequest });

  const testResult = await models.unitTestResult.create({
    results,
    parentId: workspaceId,
  });

  trackSegmentEvent(SegmentEvent.unitTestRun);

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

  trackSegmentEvent(SegmentEvent.unitTestCreate);

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
  trackSegmentEvent(SegmentEvent.unitTestDelete);

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
  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(
    unitTest.parentId
  );

  const sendRequest = getSendRequestCallback(
    workspaceMeta?.activeEnvironmentId || undefined
  );

  const results = await runTests(src, { sendRequest });

  const testResult = await models.unitTestResult.create({
    results,
    parentId: unitTest.parentId,
  });

  trackSegmentEvent(SegmentEvent.unitTestRun);

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

        const response = await axiosRequest({
          method: 'POST',
          url: 'https://ai.insomnia.rest/v1/generate-test',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': session.getCurrentSessionId(),
          },
          data: {
            teamId: organizationId,
            request: requests.find(r => r._id === test.requestId),
            methodInfo,
          },
        });

        const aiTest = response.data.test;

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

  for (const test of tests) {
    async function generateTest() {
      try {
        const response = await axiosRequest({
          method: 'POST',
          url: 'https://ai.insomnia.rest/v1/generate-test',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': session.getCurrentSessionId(),
          },
          data: {
            teamId: organizationId,
            request: requests.find(r => r._id === test.requestId),
          },
        });

        const aiTest = response.data.test;

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

export const accessAIApiAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  try {
    const response = await axiosRequest({
      method: 'POST',
      url: 'https://ai.insomnia.rest/v1/access',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': session.getCurrentSessionId(),
      },
      data: {
        teamId: organizationId,
      },
    });

    const enabled = response.data.enabled;

    return {
      enabled,
    };
  } catch (err) {
    console.log(err);
    return { enabled: false };
  }
};
