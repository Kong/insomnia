import React, { Fragment, useRef, useState } from 'react';
import {
  Button,
  DropIndicator,
  Heading,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  useDragAndDrop,
} from 'react-aria-components';
import {
  type LoaderFunction,
  redirect,
  useFetcher,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';

import { database } from '../../common/database';
import { documentationLinks } from '../../common/documentation';
import * as models from '../../models';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRequest, type Request } from '../../models/request';
import type { UnitTest } from '../../models/unit-test';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { isWebSocketRequest } from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import {
  CodeEditor,
  type CodeEditorHandle,
} from '../components/codemirror/code-editor';
import { EditableInput } from '../components/editable-input';
import { Icon } from '../components/icon';
import { showModal } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { getMethodShortHand } from '../components/tags/method-tag';

const UnitTestItemView = ({
  unitTest,
}: {
  unitTest: UnitTest;
  testsRunning: boolean;
}) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  const { projectId, workspaceId, organizationId } = useParams() as {
    workspaceId: string;
    projectId: string;
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

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-[--padding-sm] flex-shrink-0 overflow-hidden">
      <div className="flex items-center gap-2 w-full" title={unitTest.name}>
        <Button
          className="flex flex-shrink-0 flex-nowrap items-center justify-center aspect-square h-8 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          onPress={() => setIsOpen(!isOpen)}
        >
          <Icon icon={isOpen ? 'chevron-down' : 'chevron-right'} />
        </Button>
        <Heading className="flex-1 truncate">
          <EditableInput
            className='w-full px-1'
            onSubmit={name => {
              if (name) {
                updateUnitTestFetcher.submit(
                  {
                    name,
                  },
                  {
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
                    method: 'POST',
                    encType: 'application/json',
                  }
                );
              }
            }}
            value={unitTest.name}
          />
        </Heading>
        <Select
          className="flex-shrink-0"
          aria-label="Request for test"
          onSelectionChange={requestId => {
            updateUnitTestFetcher.submit(
              {
                requestId,
              },
              {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
                method: 'post',
                encType: 'application/json',
              }
            );
          }}
          selectedKey={unitTest.requestId}
        >
          <Button aria-label='Select a request' className="px-4 py-1 flex flex-1 h-8 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
            <SelectValue<Request> className="flex truncate items-center justify-center gap-2">
              {({ isPlaceholder, selectedItem: request }) => {
                if (isPlaceholder || !request) {
                  return <span>Select a request</span>;
                }

                return (
                  <Fragment>
                    {isRequest(request) && (
                      <span
                        className={
                          `w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                              ${{
                            'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                            'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                            'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                            'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                            'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                            'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                            'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
                          }[request.method] || 'text-[--color-font] bg-[--hl-md]'}`
                        }
                      >
                        {getMethodShortHand(request)}
                      </span>
                    )}
                    {isWebSocketRequest(request) && (
                      <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]">
                        WS
                      </span>
                    )}
                    {isGrpcRequest(request) && (
                      <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]">
                        gRPC
                      </span>
                    )}
                    <span>{request.name || request.url || 'Untitled request'}</span>
                  </Fragment>
                );
              }}
            </SelectValue>
            <Icon icon="caret-down" />
          </Button>
          <Popover className="min-w-max">
            <ListBox
              items={requests.map(request => ({
                ...request,
                id: request._id,
                key: request._id,
              }))}
              className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[50vh] focus:outline-none"
            >
              {request => (
                <ListBoxItem
                  className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                  aria-label={request.name}
                  textValue={request.name}
                  value={request}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      {isRequest(request) && (
                        <span
                          className={
                            `w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                            ${{
                              'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                              'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                              'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                              'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                              'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                              'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                              'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
                            }[request.method] || 'text-[--color-font] bg-[--hl-md]'}`
                          }
                        >
                          {getMethodShortHand(request)}
                        </span>
                      )}
                      {isWebSocketRequest(request) && (
                        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]">
                          WS
                        </span>
                      )}
                      {isGrpcRequest(request) && (
                        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]">
                          gRPC
                        </span>
                      )}
                      <span>{request.name || request.url || 'Untitled request'}</span>
                      {isSelected && (
                        <Icon
                          icon="check"
                          className="text-[--color-success] justify-self-end"
                        />
                      )}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
        <Button
          className="flex flex-shrink-0 items-center justify-center aspect-square h-8 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          onPress={() => {
            showModal(AskModal, {
              title: 'Delete Test',
              message: `Do you really want to delete "${unitTest.name}"?`,
              yesText: 'Delete',
              noText: 'Cancel',
              color: 'danger',
              onDone: async (isYes: boolean) => {
                if (isYes) {
                  deleteUnitTestFetcher.submit(
                    {},
                    {
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/delete`,
                      method: 'POST',
                    }
                  );
                }
              },
            });
          }}
        >
          <Icon icon="trash" />
        </Button>
        <Button
          className="flex flex-shrink-0 items-center justify-center aspect-square h-8 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          onPress={() => {
            runTestFetcher.submit(
              {},
              {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/run`,
                method: 'post',
              }
            );
          }}
        >
          <Icon icon="play" />
        </Button>
      </div>
      {isOpen && (
        <CodeEditor
          id="unit-test-editor"
          ref={editorRef}
          dynamicHeight
          showPrettifyButton
          defaultValue={unitTest ? unitTest.code : ''}
          getAutocompleteSnippets={() => {
            const value = editorRef.current?.getValue() || '';
            const variables = value
              .split('const ')
              .filter(x => x)
              .map(x => x.split(' ')[0]);
            const numbers = variables
              .map(x => parseInt(x.match(/(\d+)/)?.[0] || ''))
              ?.filter(x => !isNaN(x));
            const highestNumberedConstant = Math.max(...numbers);
            const variableName = 'response' + (highestNumberedConstant + 1);
            return [
              {
                name: 'Send: Current request',
                displayValue: '',
                value:
                  `const ${variableName} = await insomnia.send();\n` +
                  `expect(${variableName}.status).to.equal(200);`,
              },
              ...requests.map(({ name, _id }) => ({
                name: `Send: ${name}`,
                displayValue: '',
                value:
                  `const ${variableName} = await insomnia.send('${_id}');\n` +
                  `expect(${variableName}.status).to.equal(200);`,
              })),
            ];
          }}
          lintOptions={lintOptions}
          onChange={code =>
            updateUnitTestFetcher.submit(
              {
                code,
              },
              {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/update`,
                method: 'post',
                encType: 'application/json',
              }
            )
          }
          mode="javascript"
          placeholder=""
        />
      )}
    </div>
  );
};

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'organizationId is required');
  invariant(projectId, 'projectId is required');
  invariant(workspaceId, 'workspaceId is required');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  if (workspaceMeta?.activeUnitTestSuiteId) {
    const unitTestSuite = await models.unitTestSuite.getById(
      workspaceMeta.activeUnitTestSuiteId
    );

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
export const loader: LoaderFunction = async ({
  params,
}): Promise<LoaderData> => {
  const { workspaceId, testSuiteId } = params;

  invariant(workspaceId, 'Workspace ID is required');
  invariant(testSuiteId, 'Test Suite ID is required');

  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');
  const workspaceEntities = await database.withDescendants(workspace, models.request.type, [models.request.type, models.requestGroup.type]);
  const requests: Request[] = workspaceEntities.filter(isRequest);

  const unitTestSuite = await database.getWhere<UnitTestSuite>(models.unitTestSuite.type, {
    _id: testSuiteId,
  });

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  if (workspaceMeta && workspaceMeta?.activeUnitTestSuiteId !== testSuiteId) {
    await models.workspaceMeta.update(workspaceMeta, {
      activeUnitTestSuiteId: testSuiteId,
    });
  }

  invariant(unitTestSuite, 'Test Suite not found');

  const unitTests = await database.find<UnitTest>(
    models.unitTest.type,
    {
      parentId: testSuiteId,
    },
    {
      metaSortKey: 1,
    }
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
  const { unitTestSuite, unitTests } = useRouteLoaderData(
    ':testSuiteId'
  ) as LoaderData;

  const createUnitTestFetcher = useFetcher();
  const runAllTestsFetcher = useFetcher();
  const updateTestSuiteFetcher = useFetcher();
  const updateUnitTestFetcher = useFetcher();

  const testsRunning = runAllTestsFetcher.state === 'submitting';

  const optimisticUpdateTestSuiteName = updateTestSuiteFetcher.json && typeof updateTestSuiteFetcher.json === 'object' &&
    'name' in updateTestSuiteFetcher.json && updateTestSuiteFetcher.json?.name?.toString();

  const testSuiteName =
    optimisticUpdateTestSuiteName ||
    unitTestSuite.name;

  const unitTestsDragAndDrop = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(e) {
      const source = [...e.keys][0];
      const sourceTest = unitTests.find(test => test._id === source);
      const targetTest = unitTests.find(test => test._id === e.target.key);

      if (!sourceTest || !targetTest) {
        return;
      }
      const dropPosition = e.target.dropPosition;
      if (dropPosition === 'before') {
        const currentTestIndex = unitTests.findIndex(test => test._id === targetTest._id);
        const previousTest = unitTests[currentTestIndex - 1];
        if (!previousTest) {
          sourceTest.metaSortKey = targetTest.metaSortKey - 1;
        } else {
          sourceTest.metaSortKey = (previousTest.metaSortKey + targetTest.metaSortKey) / 2;
        }
      }
      if (dropPosition === 'after') {
        const currentTestIndex = unitTests.findIndex(test => test._id === targetTest._id);
        const nextEnv = unitTests[currentTestIndex + 1];
        if (!nextEnv) {
          sourceTest.metaSortKey = targetTest.metaSortKey + 1;
        } else {
          sourceTest.metaSortKey = (nextEnv.metaSortKey + targetTest.metaSortKey) / 2;
        }
      }

      updateUnitTestFetcher.submit(
        { metaSortKey: sourceTest.metaSortKey },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${sourceTest._id}/update`,
          method: 'POST',
          encType: 'application/json',
        }
      );
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className="outline-[--color-surprise] outline-1 outline !border-none"
        />
      );
    },
  });

  return (
    <div className="flex flex-col h-full w-full overflow-hidden divide-solid divide-y divide-[--hl-md]" title={testSuiteName}>
      <div className="flex h-[--line-height-sm] flex-shrink-0 gap-2 items-center px-[--padding-md]">
        <Heading className="text-lg flex-shrink-0 flex items-center gap-2 w-full truncate flex-1">
          <EditableInput
            className='w-full px-1'
            onSubmit={name =>
              name &&
              updateTestSuiteFetcher.submit(
                { name },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/update`,
                  method: 'POST',
                  encType: 'application/json',
                }
              )
            }
            value={testSuiteName}
          />
        </Heading>
        <Button
          aria-label="New test"
          className="px-4 py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          onPress={() =>
            createUnitTestFetcher.submit(
              {
                name: 'Returns 200',
              },
              {
                method: 'POST',
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/new`,
              }
            )
          }
        >
          <Icon icon="plus" />
          <span>New test</span>
        </Button>
        <Button
          aria-label="Run all tests"
          className={`px-4 py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm ${testsRunning ? 'animate-pulse' : ''}`}
          onPress={() => {
            runAllTestsFetcher.submit(
              {},
              {
                method: 'POST',
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/run-all-tests`,
              }
            );
          }}
        >
          Run tests
          <i className="fa fa-play space-left" />
        </Button>
      </div>
      {unitTests.length === 0 && (
        <div className="h-full w-full flex-1 overflow-y-auto divide-solid divide-y divide-[--hl-md] p-[--padding-md] flex flex-col items-center gap-2 overflow-hidden text-[--hl-lg]">
          <Heading className="text-lg p-[--padding-sm] font-bold flex-1 flex items-center flex-col gap-2">
            <Icon icon="vial" className="flex-1 w-28" />
            <span>Add unit tests to verify your API</span>
          </Heading>
          <div className="flex-1 w-full flex flex-col justify-evenly items-center gap-2 p-[--padding-sm]">
            <p className="flex items-center gap-2">
              <Icon icon="lightbulb" />
              <span className="truncate">
                You can run these tests in CI with Inso CLI
              </span>
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  className="font-bold flex items-center gap-2 text-sm hover:text-[--hl] focus:text-[--hl] transition-colors"
                  href={documentationLinks.unitTesting.url}
                >
                  <span className="truncate">Unit testing in Insomnia</span>
                  <Icon icon="external-link" />
                </a>
              </li>
              <li>
                <a
                  className="font-bold flex items-center gap-2 text-sm hover:text-[--hl] focus:text-[--hl] transition-colors"
                  href={documentationLinks.introductionToInsoCLI.url}
                >
                  <span className="truncate">Introduction to Inso CLI</span>
                  <Icon icon="external-link" />
                </a>
              </li>
            </ul>
          </div>
        </div>
      )}
      {unitTests.length > 0 && (
        <ListBox
          aria-label='Unit tests'
          dragAndDropHooks={unitTestsDragAndDrop.dragAndDropHooks}
          items={unitTests.map(unitTest => ({
            ...unitTest,
            id: unitTest._id,
            key: unitTest._id,
          }))}
          className="flex-1 flex flex-col divide-y divide-solid divide-[--hl-md] overflow-y-auto"
        >
          {unitTest => (
            <ListBoxItem className="outline-none">
              <Button slot="drag" className="hidden" />
              <UnitTestItemView
                unitTest={unitTest}
                testsRunning={testsRunning}
              />
            </ListBoxItem>
          )}
        </ListBox>
      )}
    </div>
  );
};

export default TestSuiteRoute;
