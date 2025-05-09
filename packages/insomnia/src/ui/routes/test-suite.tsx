import React, { Fragment, useRef, useState } from 'react';
import {
  Button,
  DropIndicator,
  GridList,
  GridListItem,
  Heading,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  useDragAndDrop,
} from 'react-aria-components';
import { type LoaderFunction, redirect, useFetcher, useParams, useRouteLoaderData } from 'react-router';

import { database } from '../../common/database';
import { documentationLinks } from '../../common/documentation';
import * as models from '../../models';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRequest, type Request } from '../../models/request';
import type { UnitTest } from '../../models/unit-test';
import type { UnitTestSuite } from '../../models/unit-test-suite';
import { isWebSocketRequest } from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import { CodeEditor, type CodeEditorHandle } from '../components/codemirror/code-editor';
import { EditableInput } from '../components/editable-input';
import { Icon } from '../components/icon';
import { showModal } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { getMethodShortHand } from '../components/tags/method-tag';

const UnitTestItemView = ({ unitTest }: { unitTest: UnitTest; testsRunning: boolean }) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  const { projectId, workspaceId, organizationId } = useParams() as {
    workspaceId: string;
    projectId: string;
    organizationId: string;
  };
  const { unitTestSuite, requests } = useRouteLoaderData(':testSuiteId') as LoaderData;

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
    <div className="flex-shrink-0 overflow-hidden p-[--padding-sm]">
      <div className="flex w-full items-center gap-2" title={unitTest.name}>
        <Button
          className="flex aspect-square h-8 flex-shrink-0 flex-nowrap items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          onPress={() => setIsOpen(!isOpen)}
        >
          <Icon icon={isOpen ? 'chevron-down' : 'chevron-right'} />
        </Button>
        <Heading className="flex-1 truncate">
          <EditableInput
            className="w-full px-1"
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
                  },
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
              },
            );
          }}
          selectedKey={unitTest.requestId}
        >
          <Button
            aria-label="Select a request"
            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          >
            <SelectValue<Request> className="flex items-center justify-center gap-2 truncate">
              {({ isPlaceholder, selectedItem: request }) => {
                if (isPlaceholder || !request) {
                  return <span>Select a request</span>;
                }

                return (
                  <Fragment>
                    {isRequest(request) && (
                      <span
                        className={`flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] text-[0.65rem] ${
                          {
                            GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-[--color-font-surprise]',
                            POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-[--color-font-success]',
                            HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                            OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                            DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-[--color-font-danger]',
                            PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-[--color-font-warning]',
                            PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-[--color-font-notice]',
                          }[request.method] || 'bg-[--hl-md] text-[--color-font]'
                        }`}
                      >
                        {getMethodShortHand(request)}
                      </span>
                    )}
                    {isWebSocketRequest(request) && (
                      <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-[--color-font-notice]">
                        WS
                      </span>
                    )}
                    {isGrpcRequest(request) && (
                      <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-[--color-font-info]">
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
          <Popover className="flex min-w-max flex-col overflow-y-hidden">
            <ListBox
              items={requests.map(request => ({
                ...request,
                id: request._id,
                key: request._id,
              }))}
              className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
            >
              {request => (
                <ListBoxItem
                  className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={request.name}
                  textValue={request.name}
                  value={request}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      {isRequest(request) && (
                        <span
                          className={`flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] text-[0.65rem] ${
                            {
                              GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-[--color-font-surprise]',
                              POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-[--color-font-success]',
                              HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                              OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                              DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-[--color-font-danger]',
                              PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-[--color-font-warning]',
                              PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-[--color-font-notice]',
                            }[request.method] || 'bg-[--hl-md] text-[--color-font]'
                          }`}
                        >
                          {getMethodShortHand(request)}
                        </span>
                      )}
                      {isWebSocketRequest(request) && (
                        <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-[--color-font-notice]">
                          WS
                        </span>
                      )}
                      {isGrpcRequest(request) && (
                        <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-[--color-font-info]">
                          gRPC
                        </span>
                      )}
                      <span>{request.name || request.url || 'Untitled request'}</span>
                      {isSelected && <Icon icon="check" className="justify-self-end text-[--color-success]" />}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
        <Button
          className="flex aspect-square h-8 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
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
                    },
                  );
                }
              },
            });
          }}
        >
          <Icon icon="trash" />
        </Button>
        <Button
          className="flex aspect-square h-8 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          onPress={() => {
            runTestFetcher.submit(
              {},
              {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/${unitTest._id}/run`,
                method: 'post',
              },
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
            const numbers = variables.map(x => parseInt(x.match(/(\d+)/)?.[0] || ''))?.filter(x => !isNaN(x));
            const highestNumberedConstant = Math.max(...numbers);
            const variableName = 'response' + (highestNumberedConstant + 1);
            return [
              {
                name: 'Send: Current request',
                displayValue: '',
                value:
                  `const ${variableName} = await insomnia.send();\n` + `expect(${variableName}.status).to.equal(200);`,
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
              },
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
    const unitTestSuite = await models.unitTestSuite.getById(workspaceMeta.activeUnitTestSuiteId);

    if (unitTestSuite) {
      return redirect(
        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}`,
      );
    }
  }

  const unitTestSuites = await models.unitTestSuite.findByParentId(workspaceId);
  if (unitTestSuites.length > 0) {
    return redirect(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuites[0]._id}`,
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
  const workspaceEntities = await database.withDescendants(workspace, models.request.type, [
    models.request.type,
    models.requestGroup.type,
  ]);
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
    },
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
  const updateTestSuiteFetcher = useFetcher();
  const updateUnitTestFetcher = useFetcher();

  const testsRunning = runAllTestsFetcher.state === 'submitting';

  const optimisticUpdateTestSuiteName =
    updateTestSuiteFetcher.json &&
    typeof updateTestSuiteFetcher.json === 'object' &&
    'name' in updateTestSuiteFetcher.json &&
    updateTestSuiteFetcher.json?.name?.toString();

  const testSuiteName = optimisticUpdateTestSuiteName || unitTestSuite.name;

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
        },
      );
    },
    renderDropIndicator(target) {
      return <DropIndicator target={target} className="!border-none outline outline-1 outline-[--color-surprise]" />;
    },
  });

  return (
    <div
      className="flex h-full w-full flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden"
      title={testSuiteName}
    >
      <div className="flex h-[--line-height-sm] flex-shrink-0 items-center gap-2 px-[--padding-md]">
        <Heading className="flex w-full flex-1 flex-shrink-0 items-center gap-2 truncate text-lg">
          <EditableInput
            className="w-full px-1"
            onSubmit={name =>
              name &&
              updateTestSuiteFetcher.submit(
                { name },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/update`,
                  method: 'POST',
                  encType: 'application/json',
                },
              )
            }
            value={testSuiteName}
          />
        </Heading>
        <Button
          aria-label="New test"
          className="flex items-center justify-center gap-2 rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          onPress={() =>
            createUnitTestFetcher.submit(
              {
                name: 'Returns 200',
              },
              {
                method: 'POST',
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/test/new`,
              },
            )
          }
        >
          <Icon icon="plus" />
          <span>New test</span>
        </Button>
        <Button
          aria-label="Run all tests"
          className={`flex items-center justify-center gap-2 rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] ${testsRunning ? 'animate-pulse' : ''}`}
          onPress={() => {
            runAllTestsFetcher.submit(
              {},
              {
                method: 'POST',
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}/run-all-tests`,
              },
            );
          }}
        >
          Run tests
          <i className="fa fa-play space-left" />
        </Button>
      </div>
      {unitTests.length === 0 && (
        <div className="flex h-full w-full flex-1 flex-col items-center gap-2 divide-y divide-solid divide-[--hl-md] overflow-hidden overflow-y-auto p-[--padding-md] text-[--hl-lg]">
          <Heading className="flex flex-1 flex-col items-center gap-2 p-[--padding-sm] text-lg font-bold">
            <Icon icon="vial" className="w-28 flex-1" />
            <span>Add unit tests to verify your API</span>
          </Heading>
          <div className="flex w-full flex-1 flex-col items-center justify-evenly gap-2 p-[--padding-sm]">
            <p className="flex items-center gap-2">
              <Icon icon="lightbulb" />
              <span className="truncate">You can run these tests in CI with Inso CLI</span>
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <a
                  className="flex items-center gap-2 text-sm font-bold transition-colors hover:text-[--hl] focus:text-[--hl]"
                  href={documentationLinks.unitTesting.url}
                >
                  <span className="truncate">Unit testing in Insomnia</span>
                  <Icon icon="external-link" />
                </a>
              </li>
              <li>
                <a
                  className="flex items-center gap-2 text-sm font-bold transition-colors hover:text-[--hl] focus:text-[--hl]"
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
        <GridList
          aria-label="Unit tests"
          dragAndDropHooks={unitTestsDragAndDrop.dragAndDropHooks}
          items={unitTests.map(unitTest => ({
            ...unitTest,
            id: unitTest._id,
            key: unitTest._id,
          }))}
          className="flex flex-1 flex-col divide-y divide-solid divide-[--hl-md] overflow-y-auto"
        >
          {unitTest => (
            <GridListItem textValue={unitTest.name} className="outline-none">
              <Button slot="drag" className="hidden" />
              <UnitTestItemView unitTest={unitTest} testsRunning={testsRunning} />
            </GridListItem>
          )}
        </GridList>
      )}
    </div>
  );
};

export default TestSuiteRoute;
