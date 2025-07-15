import path from 'node:path';

import { type IRuleResult } from '@stoplight/spectral-core';
import { generate, runTests, type Test } from 'insomnia-testing';
import type { TestResults } from 'insomnia-testing/src/run/entities';
import { type ActionFunction, redirect } from 'react-router';

import { parseApiSpec, resolveComponentSchemaRefs } from '../../common/api-specs';
import { ACTIVITY_DEBUG, getAIServiceURL } from '../../common/constants';
import { database } from '../../common/database';
import { importResourcesToWorkspace, scanResources, type ScanResult } from '../../common/import';
import { generateId } from '../../common/misc';
import * as models from '../../models';
import { EnvironmentType } from '../../models/environment';
import { getById, update } from '../../models/helpers/request-operations';
import { isGitProject } from '../../models/project';
import { isRequest, type Request } from '../../models/request';
import { isRequestGroup, isRequestGroupId } from '../../models/request-group';
import { isRequestGroupMeta } from '../../models/request-group-meta';
import type { UnitTest } from '../../models/unit-test';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { getSendRequestCallback } from '../../network/unit-test-feature';
import { insomniaFetch } from '../../ui/insomniaFetch';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export function safeToUseInsomniaFileName(fileName: string) {
  const fileNameWithoutExt = fileName.replace('.yaml', '').replace('.yml', '');
  const fileNameWithSafeCharacters = fileNameWithoutExt
    .toLowerCase()
    .trim()
    // Replace all non-alphanumeric characters with underscores, allow -
    .replace(/[^a-z0-9_-]/g, '_');

  return fileNameWithSafeCharacters;
}

export function safeToUseInsomniaFileNameWithExt(fileName: string) {
  return `${safeToUseInsomniaFileName(fileName)}.yaml`;
}

// Test Suite

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

export const runAllTestsAction: ActionFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId, testSuiteId } = params;
  invariant(typeof projectId === 'string', 'Project ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof testSuiteId === 'string', 'Test Suite ID is required');

  const unitTests = await database.find<UnitTest>(models.unitTest.type, { parentId: testSuiteId }, { metaSortKey: 1 });
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

  let results: TestResults = {
    failures: [],
    passes: [],
    pending: [],
    stats: {
      suites: 0,
      tests: 0,
      passes: 0,
      pending: 0,
      failures: 0,
      start: undefined,
      end: undefined,
      duration: undefined,
    },
    tests: [],
  };

  try {
    results = await runTests(src, { sendRequest });
    const testResult = await models.unitTestResult.create({
      results,
      parentId: workspaceId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRunAll, properties: { organizationId, projectId } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  } catch (err) {
    // create a result manually so that it can be displayed in the UI
    results.stats.failures = 1;
    results.stats.tests = 1;
    results.tests.push({
      currentRetry: 0,
      duration: 0,
      err: {
        actual: undefined,
        expected: undefined,
        message: err.toString(),
        multiple: [],
        operator: undefined,
        showDiff: false,
        stack: '',
      },
      file: '',
      fullTitle: 'Test Error',
      id: '',
      title: 'Test Error',
    });
    const testResult = await models.unitTestResult.create({
      results,
      parentId: workspaceId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRunAll, properties: { organizationId, projectId } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  }
};

export const updateTestSuiteAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId, projectId, testSuiteId } = params;
  invariant(typeof testSuiteId === 'string', 'Test Suite ID is required');
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof projectId === 'string', 'Project ID is required');

  const data = (await request.json()) as Partial<UnitTestSuite>;

  const unitTestSuite = await database.getWhere<UnitTestSuite>(models.unitTestSuite.type, {
    _id: testSuiteId,
  });

  invariant(unitTestSuite, 'Test Suite not found');

  await models.unitTestSuite.update(unitTestSuite, data);

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
  const data = (await request.json()) as Partial<UnitTest>;

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
    _id: testId,
  });
  invariant(unitTest, 'Test not found');

  await models.unitTest.update(unitTest, data);

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

  let results: TestResults = {
    failures: [],
    passes: [],
    pending: [],
    stats: {
      suites: 0,
      tests: 0,
      passes: 0,
      pending: 0,
      failures: 0,
      start: undefined,
      end: undefined,
      duration: undefined,
    },
    tests: [],
  };

  try {
    results = await runTests(src, { sendRequest });
    const testResult = await models.unitTestResult.create({
      results,
      parentId: unitTest.parentId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRun, properties: { organizationId, projectId } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  } catch (error) {
    // create a result manually so that it can be displayed in the UI
    results.stats.failures = 1;
    results.stats.tests = 1;
    results.tests.push({
      currentRetry: 0,
      duration: 0,
      err: {
        actual: undefined,
        expected: undefined,
        message: error.toString(),
        multiple: [],
        operator: undefined,
        showDiff: false,
        stack: '',
      },
      file: '',
      fullTitle: unitTest.name,
      id: '',
      title: unitTest.name,
    });
    const testResult = await models.unitTestResult.create({
      results,
      parentId: unitTest.parentId,
    });
    window.main.trackSegmentEvent({ event: SegmentEvent.unitTestRun, properties: { organizationId, projectId } });

    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test-result/${testResult._id}`,
    );
  }
};

// Api Spec
export const updateApiSpecAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const formData = await request.formData();
  const contents = formData.get('contents');
  const fromSync = Boolean(formData.get('fromSync'));

  invariant(typeof contents === 'string', 'Contents is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  invariant(apiSpec, 'API Spec not found');
  await database.update(
    {
      ...apiSpec,
      modified: Date.now(),
      created: fromSync ? Date.now() : apiSpec.created,
      contents,
    },
    fromSync,
  );

  return null;
};

export const generateCollectionFromApiSpecAction: ActionFunction = async ({ params }) => {
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

  const gitRepositoryId = workspaceMeta?.gitRepositoryId;
  const isLintError = (result: IRuleResult) => result.severity === 0;
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

  const resources = await scanResources([
    {
      contentStr: apiSpec.contents,
    },
  ]);

  const allRequestsFromResources = resources.reduce(
    (accumulator, scanResult) => accumulator.concat(scanResult.requests ?? []),
    [] as NonNullable<ScanResult['requests']>,
  );

  const aiGeneratedRequestGroup = await models.requestGroup.create({
    name: 'AI Generated Requests',
    parentId: workspaceId,
  });

  const requests =
    allRequestsFromResources.filter(isRequest).map(request => {
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

        const user = await models.userSession.getOrCreate();
        const sessionId = user.id;

        const methodInfo = resolveComponentSchemaRefs(spec, getMethodInfo(request));
        const response = await insomniaFetch<{ test: { requestId: string } }>({
          method: 'POST',
          origin: getAIServiceURL(),
          path: '/v1/generate-test',
          sessionId,
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
      const user = await models.userSession.getOrCreate();
      const sessionId = user.id;
      try {
        const response = await insomniaFetch<{ test: { requestId: string } }>({
          method: 'POST',
          origin: getAIServiceURL(),
          path: '/v1/generate-test',
          sessionId,
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
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;
    const response = await insomniaFetch<{ enabled: boolean }>({
      method: 'POST',
      origin: getAIServiceURL(),
      path: '/v1/access',
      sessionId,
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

export const createEnvironmentAction: ActionFunction = async ({ params, request }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const { isPrivate, environmentType = EnvironmentType.KVPAIR } = await request.json();

  const baseEnvironment = await models.environment.getByParentId(workspaceId);

  invariant(baseEnvironment, 'Base environment not found');

  const environment = await models.environment.create({
    parentId: baseEnvironment._id,
    environmentType,
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

export const deleteEnvironmentAction: ActionFunction = async ({ request, params }) => {
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

export const duplicateEnvironmentAction: ActionFunction = async ({ request, params }) => {
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

export const setActiveEnvironmentAction: ActionFunction = async ({ request, params }) => {
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

export const setActiveGlobalEnvironmentAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const formData = await request.formData();

  const environmentId = formData.get('environmentId');

  invariant(typeof environmentId === 'string', 'Environment ID is required');

  const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);

  invariant(workspaceMeta, 'Workspace meta not found');

  await models.workspaceMeta.update(workspaceMeta, { activeGlobalEnvironmentId: environmentId || null });

  return null;
};

export const updateCookieJarAction: ActionFunction = async ({ request, params }) => {
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
  const certificate = await models.clientCertificate.create(patch);
  return {
    certificate,
  };
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
  if ('enableAnalytics' in patch && !patch.enableAnalytics) {
    window.main.trackSegmentEvent({ event: SegmentEvent.analyticsDisabled });
  }
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
  const { workspaceId } = params;
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

export const createMockRouteAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;

  const patch = await request.json();
  invariant(typeof patch.name === 'string', 'Name is required');
  // TODO: remove this hack which enables a mock server to be created alongside a route
  // TODO: use an alternate method to create new workspace and server together
  // create a mock server under the workspace with the same name
  if (patch.mockServerName) {
    const collectionWorkspace = await models.workspace.getById(workspaceId);
    invariant(collectionWorkspace, 'Collection workspace not found');
    const mockWorkspace = await models.workspace.create({
      name: collectionWorkspace.name,
      scope: 'mock-server',
      parentId: projectId,
    });
    invariant(mockWorkspace, 'Workspace not found');
    const newMockServer = await models.mockServer.getOrCreateForParentId(mockWorkspace._id, {
      name: collectionWorkspace.name,
    });
    delete patch.mockServerName;
    const mockRoute = await models.mockRoute.create({ ...patch, parentId: newMockServer._id });
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${newMockServer.parentId}/mock-server/mock-route/${mockRoute._id}`,
    );
  }
  const mockServer = await models.mockServer.getById(patch.parentId);
  invariant(mockServer, 'Mock server not found');
  const mockRoute = await models.mockRoute.create(patch);
  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${mockServer.parentId}/mock-server/mock-route/${mockRoute._id}`,
  );
};
export const updateMockRouteAction: ActionFunction = async ({ request, params }) => {
  const { mockRouteId } = params;
  invariant(typeof mockRouteId === 'string', 'Mock route id is required');
  const patch = await request.json();

  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'Mock route is required');

  await models.mockRoute.update(mockRoute, patch);
  return null;
};
export const deleteMockRouteAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId, mockRouteId } = params;
  invariant(typeof mockRouteId === 'string', 'Mock route id is required');
  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'mockRoute not found');
  const { isSelected } = await request.json();

  await models.mockRoute.remove(mockRoute);
  if (isSelected) {
    return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server`);
  }
  return null;
};
export const updateMockServerAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const patch = await request.json();
  const mockServer = await models.mockServer.getByParentId(workspaceId);
  invariant(mockServer, 'Mock server not found');
  await models.mockServer.update(mockServer, patch);
  return null;
};

export const toggleExpandAllRequestGroupsAction: ActionFunction = async ({ params, request }) => {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const data = (await request.json()) as {
    toggle: 'collapse-all' | 'expand-all';
  };
  const isCollapsed = data.toggle === 'collapse-all';

  const descendants = await database.withDescendants(workspace);
  const requestGroups = descendants.filter(isRequestGroup);
  const requestGroupMetas = descendants.filter(isRequestGroupMeta);
  await Promise.all(
    requestGroups.map(requestGroup => {
      const requestGroupMeta = requestGroupMetas.find(meta => meta.parentId === requestGroup._id);

      if (requestGroupMeta) {
        return models.requestGroupMeta.update(requestGroupMeta, { collapsed: isCollapsed });
      }
      return models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: isCollapsed });
    }),
  );
  return null;
};
