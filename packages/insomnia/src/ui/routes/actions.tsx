import type { IRuleResult } from '@stoplight/spectral-core';
import { generate, runTests, Test } from 'insomnia-testing';
import { ActionFunction, redirect } from 'react-router-dom';

import * as session from '../../account/session';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../common/constants';
import { database } from '../../common/database';
import { importRaw } from '../../common/import';
import * as models from '../../models';
import * as workspaceOperations from '../../models/helpers/workspace-operations';
import { DEFAULT_ORGANIZATION_ID } from '../../models/organization';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../../models/project';
import { UnitTest } from '../../models/unit-test';
import { isCollection } from '../../models/workspace';
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
    `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${
      workspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC
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

  await models.workspace.ensureChildren(newWorkspace);

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
    `/organization/${organizationId}/project/${projectId}/workspace/${newWorkspace._id}/${
      newWorkspace.scope === 'collection' ? ACTIVITY_DEBUG : ACTIVITY_SPEC
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
};

export const generateCollectionFromApiSpecAction: ActionFunction = async ({
  params,
}) => {
  const { organizationId, projectId, workspaceId } = params;

  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  if (!apiSpec) {
    throw new Error('No API Specification was found');
  }
  const isLintError = (result: IRuleResult) => result.severity === 0;
  const results = (await window.main.spectralRun(apiSpec.contents)).filter(isLintError);
  if (apiSpec.contents && results && results.length) {
    throw new Error('Error Generating Configuration');
  }

  await importRaw(apiSpec.contents, {
    getWorkspaceId: () => Promise.resolve(workspaceId),
    enableDiffBasedPatching: true,
    enableDiffDeep: true,
    bypassDiffProps: {
      url: true,
    },
  });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_DEBUG}`);
};
