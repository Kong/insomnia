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
import { useParams, useRouteLoaderData } from 'react-router';

import { database } from '~/common/database';
import { documentationLinks } from '~/common/documentation';
import * as models from '~/models';
import { isGrpcRequest } from '~/models/grpc-request';
import { isRequest, type Request } from '~/models/request';
import type { UnitTest } from '~/models/unit-test';
import type { UnitTestSuite } from '~/models/unit-test-suite';
import { isWebSocketRequest } from '~/models/websocket-request';
import { useRunAllTestsActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.run-all-tests';
import { useTestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.$testId.delete';
import { useTestRunActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.$testId.run';
import { useTestUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.$testId.update';
import { useTestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.new';
import { useTestSuiteUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.update';
import { CodeEditor, type CodeEditorHandle } from '~/ui/components/.client/codemirror/code-editor';
import { EditableInput } from '~/ui/components/editable-input';
import { Icon } from '~/ui/components/icon';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { getMethodShortHand } from '~/ui/components/tags/method-tag';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId';

export function useUnitTestSuiteLoaderData() {
  return useRouteLoaderData<typeof clientLoader>(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId',
  );
}

const UnitTestItemView = ({ unitTest }: { unitTest: UnitTest; testsRunning: boolean }) => {
  const editorRef = useRef<CodeEditorHandle>(null);
  const { projectId, workspaceId, organizationId } = useParams() as {
    workspaceId: string;
    projectId: string;
    organizationId: string;
  };
  const { unitTestSuite, requests } = useUnitTestSuiteLoaderData()!;

  const deleteUnitTestFetcher = useTestDeleteActionFetcher();
  const runTestFetcher = useTestRunActionFetcher();
  const updateUnitTestFetcher = useTestUpdateActionFetcher();

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
                updateUnitTestFetcher.submit({
                  organizationId,
                  projectId,
                  workspaceId,
                  testSuiteId: unitTestSuite._id,
                  testId: unitTest._id,
                  data: {
                    name,
                  },
                });
              }
            }}
            value={unitTest.name}
          />
        </Heading>
        <Select
          className="flex-shrink-0"
          aria-label="Request for test"
          onSelectionChange={key => {
            const requestId = key.toString();
            updateUnitTestFetcher.submit({
              organizationId,
              projectId,
              workspaceId,
              testSuiteId: unitTestSuite._id,
              testId: unitTest._id,
              data: {
                requestId,
              },
            });
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
                  deleteUnitTestFetcher.submit({
                    organizationId,
                    projectId,
                    workspaceId,
                    testSuiteId: unitTestSuite._id,
                    testId: unitTest._id,
                  });
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
            runTestFetcher.submit({
              organizationId,
              projectId,
              workspaceId,
              testSuiteId: unitTestSuite._id,
              testId: unitTest._id,
            });
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
            updateUnitTestFetcher.submit({
              organizationId,
              projectId,
              workspaceId,
              testSuiteId: unitTestSuite._id,
              testId: unitTest._id,
              data: {
                code,
              },
            })
          }
          mode="javascript"
          placeholder=""
        />
      )}
    </div>
  );
};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { workspaceId, testSuiteId } = params;

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
}

const Component = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const { unitTestSuite, unitTests } = useUnitTestSuiteLoaderData()!;

  const createUnitTestFetcher = useTestNewActionFetcher();
  const runAllTestsFetcher = useRunAllTestsActionFetcher();
  const updateTestSuiteFetcher = useTestSuiteUpdateActionFetcher();
  const updateUnitTestFetcher = useTestUpdateActionFetcher();

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

      updateUnitTestFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        testSuiteId: unitTestSuite._id,
        testId: sourceTest._id,
        data: {
          metaSortKey: sourceTest.metaSortKey,
        },
      });
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
              updateTestSuiteFetcher.submit({
                organizationId,
                projectId,
                workspaceId,
                testSuiteId: unitTestSuite._id,
                data: { name },
              })
            }
            value={testSuiteName}
          />
        </Heading>
        <Button
          aria-label="New test"
          className="flex items-center justify-center gap-2 rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          onPress={() =>
            createUnitTestFetcher.submit({
              organizationId,
              projectId,
              workspaceId,
              testSuiteId: unitTestSuite._id,
              name: 'Returns 200',
            })
          }
        >
          <Icon icon="plus" />
          <span>New test</span>
        </Button>
        <Button
          aria-label="Run all tests"
          className={`flex items-center justify-center gap-2 rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] ${testsRunning ? 'animate-pulse' : ''}`}
          onPress={() => {
            runAllTestsFetcher.submit({
              organizationId,
              projectId,
              workspaceId,
              testSuiteId: unitTestSuite._id,
            });
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

export default Component;
