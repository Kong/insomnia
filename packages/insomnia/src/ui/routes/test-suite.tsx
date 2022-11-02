import { invariant } from '@remix-run/router';
import { isEmpty } from 'ramda';
import React, { useCallback } from 'react';
import {
  LoaderFunction,
  redirect,
  useFetcher,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';
import styled from 'styled-components';

import { database } from '../../common/database';
import { documentationLinks } from '../../common/documentation';
import * as models from '../../models';
import { isRequest, Request } from '../../models/request';
import { isUnitTest, UnitTest } from '../../models/unit-test';
import { UnitTestSuite } from '../../models/unit-test-suite';
import { Editable } from '../components/base/editable';
import { CodeEditor } from '../components/codemirror/code-editor';
import { ListGroup, UnitTestItem } from '../components/list-group';
import { showModal, showPrompt } from '../components/modals';
import { SelectModal } from '../components/modals/select-modal';
import { EmptyStatePane } from '../components/panes/empty-state-pane';
import { SvgIcon } from '../components/svg-icon';
import { Button } from '../components/themed-button';
import { UnitTestEditable } from '../components/unit-test-editable';

const HeaderButton = styled(Button)({
  '&&': {
    marginRight: 'var(--padding-md)',
  },
});

const UnitTestItemView = ({
  unitTest,
  testsRunning,
}: {
  unitTest: UnitTest;
  testsRunning: boolean;
}) => {
  const { projectId, workspaceId, testSuiteId } = useParams() as {
    workspaceId: string;
    projectId: string;
    testSuiteId: string;
  };
  const { unitTestSuite, requests } = useRouteLoaderData(
    ':testSuiteId'
  ) as LoaderData;

  const deleteUnitTestFetcher = useFetcher();
  const runTestFetcher = useFetcher();
  const updateUnitTestFetcher = useFetcher();

  const lintOptions = {
    globals: {
      // https://jshint.com/docs/options/
      insomnia: true,
      expect: true,
      chai: true,
      debugger: true,
    },
    asi: true,
    // Don't require semicolons
    undef: true,
    // Prevent undefined usages
    node: true,
    // Enable NodeJS globals
    esversion: 8, // ES8 syntax (async/await, etc)
  };

  const generateSendReqSnippet = useCallback(
    (existingCode: string, requestId: string) => {
      let variableName = 'response';
      for (let i = 1; i < 100; i++) {
        variableName = `response${i}`;
        // Try next one if code already contains this variable
        if (existingCode.includes(`const ${variableName} =`)) {
          continue;
        }
        // Found variable that doesn't exist in code yet
        break;
      }

      return (
        `const ${variableName} = await insomnia.send(${requestId});\n` +
        `expect(${variableName}.status).to.equal(200);`
      );
    },
    []
  );

  const autocompleteSnippets = useCallback(
    (unitTest: UnitTest) => {
      return [
        {
          name: 'Send Current Request',
          displayValue: '',
          value: generateSendReqSnippet(unitTest.code, ''),
        },
        {
          name: 'Send Request By ID',
          displayValue: '',
          value: async () => {
            return new Promise(resolve => {
              showModal(SelectModal, {
                title: 'Select Request',
                message: 'Select a request to fill',
                value: '__NULL__',
                options: [
                  {
                    name: '-- Select Request --',
                    value: '__NULL__',
                  },
                  ...requests.map(({ name, _id }) => ({
                    name,
                    displayValue: '',
                    value: generateSendReqSnippet(unitTest.code, `'${_id}'`),
                  })),
                ],
                onDone: (value: string | null) => resolve(value),
              });
            });
          },
        },
      ];
    },
    [requests, generateSendReqSnippet]
  );

  return (
    <UnitTestItem
      key={unitTest._id}
      item={unitTest}
      onSetActiveRequest={event =>
        updateUnitTestFetcher.submit(
          {
            code: unitTest.code,
            name: unitTest.name,
            requestId:
              event.currentTarget.value === '__NULL__'
                ? ''
                : event.currentTarget.value,
          },
          {
            action: `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
            method: 'post',
          }
        )
      }
      onDeleteTest={() =>
        deleteUnitTestFetcher.submit(
          {},
          {
            action: `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test/${unitTest._id}/delete`,
            method: 'post',
          }
        )
      }
      onRunTest={() =>
        runTestFetcher.submit(
          {},
          {
            action: `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test/${unitTest._id}/run`,
            method: 'post',
          }
        )
      }
      testsRunning={testsRunning || runTestFetcher.state === 'submitting'}
      selectedRequestId={unitTest.requestId}
      selectableRequests={requests}
      testNameEditable={
        <UnitTestEditable
          onSubmit={name =>
            name &&
            updateUnitTestFetcher.submit(
              {
                code: unitTest.code,
                name,
                requestId: unitTest.requestId || '',
              },
              {
                action: `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
                method: 'post',
              }
            )
          }
          value={`${updateUnitTestFetcher.formData?.get('name') ?? ''}` || unitTest.name}
        />
      }
    >
      <CodeEditor
        dynamicHeight
        showPrettifyButton
        defaultValue={unitTest ? unitTest.code : ''}
        getAutocompleteSnippets={() => autocompleteSnippets(unitTest)}
        lintOptions={lintOptions}
        onChange={code =>
          updateUnitTestFetcher.submit(
            {
              code,
              name: unitTest.name,
              requestId: unitTest.requestId || '',
            },
            {
              action: `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
              method: 'post',
            }
          )
        }
        mode="javascript"
        placeholder=""
      />
    </UnitTestItem>
  );
};

interface LoaderData {
  unitTests: UnitTest[];
  unitTestSuite: UnitTestSuite;
  requests: Request[];
}

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { projectId, workspaceId } = params;
  invariant(projectId, 'projectId is required');
  invariant(workspaceId, 'workspaceId is required');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  if (workspaceMeta?.activeUnitTestSuiteId) {
    const unitTestSuite = await models.unitTestSuite.getById(workspaceMeta.activeUnitTestSuiteId);

    if (unitTestSuite) {
      return redirect(
        `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}`
      );
    } else {
      const unitTestSuites = await models.unitTestSuite.findByParentId(workspaceId);

      if (unitTestSuites.length > 0) {
        return redirect(
          `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuites[0]._id}`
        );
      }
    }
  }

  return;
};

export const loader: LoaderFunction = async ({
  params,
}): Promise<LoaderData> => {
  const { workspaceId, testSuiteId } = params;

  invariant(workspaceId, 'Workspace ID is required');
  invariant(testSuiteId, 'Test Suite ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const workspaceEntities = await database.withDescendants(workspace);
  const requests: Request[] = workspaceEntities.filter(isRequest);

  const unitTestSuite = await database.getWhere(models.unitTestSuite.type, {
    _id: testSuiteId,
  });

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  if (workspaceMeta && workspaceMeta?.activeUnitTestSuiteId !== testSuiteId) {
    await models.workspaceMeta.update(workspaceMeta, {
      activeUnitTestSuiteId: testSuiteId,
    });
  }

  invariant(unitTestSuite, 'Test Suite not found');

  const unitTests = (await database.withDescendants(unitTestSuite)).filter(
    isUnitTest
  );

  return {
    unitTests,
    unitTestSuite,
    requests,
  };
};

const TestSuiteRoute = () => {
  const { projectId, workspaceId } = useParams() as {
    workspaceId: string;
    projectId: string;
    testSuiteId: string;
  };
  const { unitTestSuite, unitTests } = useRouteLoaderData(
    ':testSuiteId'
  ) as LoaderData;

  const createUnitTestFetcher = useFetcher();
  const runAllTestsFetcher = useFetcher();
  const renameTestSuiteFetcher = useFetcher();

  const testsRunning = runAllTestsFetcher.state === 'submitting';

  return (
    <div className="unit-tests theme--pane__body">
      <div className="unit-tests__top-header">
        <h2>
          <Editable
            singleClick
            onSubmit={name =>
              name &&
              renameTestSuiteFetcher.submit(
                { name },
                {
                  action: `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/rename`,
                  method: 'post',
                }
              )
            }
            value={unitTestSuite.name}
          />
        </h2>
        <HeaderButton
          variant="outlined"
          onClick={() => {
            showPrompt({
              title: 'New Test',
              defaultValue: 'Returns 200',
              submitName: 'New Test',
              label: 'Test Name',
              selectText: true,
              cancelable: true,
              onComplete: async name => {
                createUnitTestFetcher.submit(
                  {
                    name,
                  },
                  {
                    method: 'post',
                    action: `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/new`,
                  }
                );
              },
            });
          }}
        >
          New Test
        </HeaderButton>
        <HeaderButton
          variant="contained"
          bg="surprise"
          onClick={() => {
            runAllTestsFetcher.submit(
              {},
              {
                method: 'post',
                action: `/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/run-all-tests`,
              }
            );
          }}
          size="default"
          disabled={testsRunning}
        >
          {testsRunning ? 'Running... ' : 'Run Tests'}
          <i className="fa fa-play space-left" />
        </HeaderButton>
      </div>
      {isEmpty(unitTests) ? (
        <div style={{ height: '100%' }}>
          <EmptyStatePane
            icon={<SvgIcon icon="vial" />}
            documentationLinks={[
              documentationLinks.unitTesting,
              documentationLinks.introductionToInsoCLI,
            ]}
            title="Add unit tests to verify your API"
            secondaryAction="You can run these tests in CI with Inso CLI"
          />
        </div>
      ) : null}
      <ListGroup>
        {unitTests.map(unitTest => (
          <UnitTestItemView
            key={unitTest._id}
            unitTest={unitTest}
            testsRunning={testsRunning}
          />
        ))}
      </ListGroup>
    </div>
  );
};

export default TestSuiteRoute;
