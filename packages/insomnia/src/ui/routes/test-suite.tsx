import React, { useRef } from 'react';
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
import { invariant } from '../../utils/invariant';
import { Editable } from '../components/base/editable';
import { CodeEditor, CodeEditorHandle } from '../components/codemirror/code-editor';
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
  const editorRef = useRef<CodeEditorHandle>(null);
  const { projectId, workspaceId, testSuiteId, organizationId } = useParams() as {
    workspaceId: string;
    projectId: string;
    testSuiteId: string;
    organizationId: string;
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
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
            method: 'post',
          }
        )
      }
      onDeleteTest={() =>
        deleteUnitTestFetcher.submit(
          {},
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test/${unitTest._id}/delete`,
            method: 'post',
          }
        )
      }
      onRunTest={() =>
        runTestFetcher.submit(
          {},
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${testSuiteId}/test/${unitTest._id}/run`,
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
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
                method: 'post',
              }
            )
          }
          value={`${updateUnitTestFetcher.formData?.get('name') ?? ''}` || unitTest.name}
        />
      }
    >
      <CodeEditor
        id="unit-test-editor"
        ref={editorRef}
        dynamicHeight
        showPrettifyButton
        defaultValue={unitTest ? unitTest.code : ''}
        getAutocompleteSnippets={() => {
          const value = editorRef.current?.getValue() || '';
          const variables = value.split('const ').filter(x => x).map(x => x.split(' ')[0]);
          const numbers = variables.map(x => parseInt(x.match(/(\d+)/)?.[0] || ''))?.filter(x => !isNaN(x));
          const highestNumberedConstant = Math.max(...numbers);
          const variableName = 'response' + (highestNumberedConstant + 1);
          return [
            {
              name: 'Send Current Request',
              displayValue: '',
              value: `const ${variableName} = await insomnia.send();\n` +
              `expect(${variableName}.status).to.equal(200);`,
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
                        value: `const ${variableName} = await insomnia.send('${_id}');\n` +
                        `expect(${variableName}.status).to.equal(200);`,
                      })),
                    ],
                    onDone: (value: string | null) => resolve(value),
                  });
                });
              },
            },
          ];
        }}
        lintOptions={lintOptions}
        onChange={code =>
          updateUnitTestFetcher.submit(
            {
              code,
              name: unitTest.name,
              requestId: unitTest.requestId || '',
            },
            {
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
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

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'organizationId is required');
  invariant(projectId, 'projectId is required');
  invariant(workspaceId, 'workspaceId is required');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  if (workspaceMeta?.activeUnitTestSuiteId) {
    const unitTestSuite = await models.unitTestSuite.getById(workspaceMeta.activeUnitTestSuiteId);

    if (unitTestSuite) {
      return redirect(
        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}`
      );
    }
  }

  const unitTestSuites = await models.unitTestSuite.findByParentId(workspaceId);
  if (unitTestSuites.length > 0) {
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuites[0]._id}`
    );
  }
  return null;
};

interface LoaderData {
  unitTests: UnitTest[];
  unitTestSuite: UnitTestSuite;
  requests: Request[];
}
export const loader: LoaderFunction = async ({ params }): Promise<LoaderData> => {
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
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    testSuiteId: string;
  };
  const { unitTestSuite, unitTests } = useRouteLoaderData(':testSuiteId') as LoaderData;

  const createUnitTestFetcher = useFetcher();
  const runAllTestsFetcher = useFetcher();
  const renameTestSuiteFetcher = useFetcher();

  const testsRunning = runAllTestsFetcher.state === 'submitting';

  const testSuiteName = renameTestSuiteFetcher.formData?.get('name')?.toString() ?? unitTestSuite.name;
  return (
    <div className="unit-tests theme--pane__body">
      <div className="unit-tests__top-header">
        <h2>
          <Editable
            singleClick
            onSubmit={name => name && renameTestSuiteFetcher.submit(
              { name },
              {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/rename`,
                method: 'post',
              }
            )
            }
            value={testSuiteName}
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
              onComplete: name => {
                createUnitTestFetcher.submit(
                  {
                    name,
                  },
                  {
                    method: 'post',
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/new`,
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
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/run-all-tests`,
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
      {unitTests.length === 0 ? (
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
