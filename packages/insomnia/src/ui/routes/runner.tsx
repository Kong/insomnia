import type { RequestTestResult } from 'insomnia-sdk';
import React, { type FC, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, DropIndicator, GridList, GridListItem, type GridListItemProps, Heading, type Key, Tab, TabList, TabPanel, Tabs, Toolbar, TooltipTrigger, useDragAndDrop } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { type ActionFunction, redirect, useNavigate, useParams, useRouteLoaderData, useSearchParams, useSubmit } from 'react-router-dom';
import { useListData } from 'react-stately';
import { useInterval } from 'react-use';

import { Tooltip } from '../../../src/ui/components/tooltip';
import type { TimingStep } from '../../main/network/request-timing';
import * as models from '../../models';
import { isRequest, type Request } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
// import type { RunnerTestResult } from '../../models/runner-test-result';
import { invariant } from '../../utils/invariant';
import { ErrorBoundary } from '../components/error-boundary';
import { HelpTooltip } from '../components/help-tooltip';
import { Icon } from '../components/icon';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';
// import { RequestTestResultPane } from '../components/panes/request-test-result-pane';
// import { RunnerResultHistoryPane } from '../components/panes/runner-result-history-pane';
import { ResponseTimer } from '../components/response-timer';
// import { getTimeAndUnit } from '../components/tags/time-tag';
import { type RunnerSource, sendActionImp } from './request';
import { useRootLoaderData } from './root';
import type { Child, WorkspaceLoaderData } from './workspace';

const inputStyle = 'placeholder:italic py-0.5 mr-1.5 px-1 w-24 rounded-sm border-2 border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors';
const iterationInputStyle = 'placeholder:italic py-0.5 mr-1.5 px-1 w-16 rounded-sm border-2 border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors';

export const Runner: FC<{}> = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [onTestEnd, setOnTestEnd] = useState(false);
  if (searchParams.has('test-end')) {
    setOnTestEnd(true);
    // clean up params
    searchParams.delete('test-end');
    setSearchParams({});
  }

  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    direction: 'vertical' | 'horizontal';
  };
  const { settings } = useRootLoaderData();
  const { collection } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const iterationDataInput = useRef<HTMLInputElement>(null);
  const [iterationFilePath, setIterationFilePath] = useState<File | undefined>(undefined);

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(settings.forceVerticalLayout ? 'vertical' : 'horizontal');
  useEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => { };
    } else {
      // Listen on media query changes
      const mediaQuery = window.matchMedia('(max-width: 880px)');
      setDirection(mediaQuery.matches ? 'vertical' : 'horizontal');

      const handleChange = (e: MediaQueryListEvent) => {
        setDirection(e.matches ? 'vertical' : 'horizontal');
      };

      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [settings.forceVerticalLayout, direction]);

  const [iterations, setIterations] = useState(1);
  const [delay, setDelay] = useState(0);
  const getEntityById = new Map<string, Child>();
  const requestRows = collection
    .filter(item => {
      getEntityById.set(item.doc._id, item);
      return isRequest(item.doc);
    })
    .map((item: Child) => {
      const ancestorNames: string[] = [];
      if (item.ancestors) {
        item.ancestors.forEach(ancestorId => {
          const ancestor = getEntityById.get(ancestorId);
          if (ancestor && isRequestGroup(ancestor?.doc)) {
            ancestorNames.push(ancestor?.doc.name);
          }
        });
      }

      const requestDoc = item.doc as Request;
      invariant('method' in item.doc, 'Only Request is supported at the moment');
      return {
        id: item.doc._id,
        name: item.doc.name,
        ancestorNames,
        method: requestDoc.method,
        url: item.doc.url,
      };
    });
  const reqList = useListData({
    initialItems: requestRows,
  });
  const allKeys = reqList.items.map(item => item.id);

  const { dragAndDropHooks: requestsDnD } = useDragAndDrop({
    getItems: keys => {
      return [...keys].map(key => {
        const name = getEntityById.get(key as string)?.doc.name || '';
        return {
          'text/plain': key.toString(),
          name,
        };
      });
    },
    onReorder: event => {
      if (event.target.dropPosition === 'before') {
        reqList.moveBefore(event.target.key, event.keys);
      } else if (event.target.dropPosition === 'after') {
        reqList.moveAfter(event.target.key, event.keys);
      }
    },
    renderDragPreview(items) {
      return (
        <div className="bg-slate-800 px-2 py-0.5 rounded" >
          <mark className="text-lg px-2 text-extrabold bg-green-400 rounded dark:bg-green-400" style={{ color: 'black' }}>{` ${items.length}`}</mark> item(s)
        </div>
      );
    },
    renderDropIndicator(target) {
      if (target.type === 'item') {
        const item = reqList.items.find(item => item.id === target.key);
        if (item) {
          return (
            <DropIndicator
              target={target}
              className={({ isDropTarget }) => {
                return `${isDropTarget ? 'border border-solid border-[--hl-sm]' : ''}`;
              }}
            />
          );
        }
      }
      return <DropIndicator target={target} />;
    },
  });

  const submit = useSubmit();
  const onRun = () => {
    // set to null so that the result pane will not be always occupied by the selected result item
    // setGotoExecutionResultId(null);

    const selected = new Set(reqList.selectedKeys);
    const requests = Array.from(reqList.items)
      .filter(item => selected.has(item.id));

    submit(
      {
        requests,
        iterations,
        delay,
      },
      {
        method: 'post',
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner/run/`,
      }
    );
  };

  const navigate = useNavigate();
  const goToRequest = (requestId: string) => {
    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}`);
  };
  const onToggleSelection = () => {
    if (Array.from(reqList.selectedKeys).length === Array.from(reqList.items).length) {
      // unselect all
      reqList.setSelectedKeys(new Set([]));
    } else {
      // select all
      reqList.setSelectedKeys(new Set(reqList.items.map(item => item.id)));
    }
  };

  // const [testHistory, setTestHistory] = useState<RunnerTestResult[]>([]);
  // useEffect(() => {
  //   const readResults = async () => {
  //     const results = await models.runnerTestResult.findByParentId(workspaceId) || [];
  //     setTestHistory(results);
  //   };
  //   readResults();
  // }, [workspaceId]);

  const [isRunning, setIsRunning] = useState(false);
  const [timingSteps, setTimingSteps] = useState<TimingStep[]>([]);
  // const [totalTime, setTotalTime] = useState({
  //   duration: 0,
  //   unit: 'ms',
  // });

  // const [executionResult, setExecutionResult] = useState<RunnerTestResult | null>(null);
  // const gotoExecutionResult = useCallback(async (executionId: string) => {
  //   const result = await models.runnerTestResult.getById(executionId);
  //   if (result) {
  //     setExecutionResult(result);
  //   }
  // }, [setExecutionResult]);

  useInterval(() => {
    const refreshPanes = async () => {
      const latestTimingSteps = await window.main.getExecution({ requestId: workspaceId });
      if (latestTimingSteps) {
        // there is a timingStep item and it is not ended (duration is not assigned)
        const isRunning = latestTimingSteps.length > 0 && latestTimingSteps[latestTimingSteps.length - 1].stepName !== 'Done';
        setIsRunning(isRunning);

        if (isRunning) {
          // const duration = Date.now() - latestTimingSteps[latestTimingSteps.length - 1].startedAt;
          // const { number: durationNumber, unit: durationUnit } = getTimeAndUnit(duration);

          setTimingSteps(latestTimingSteps);
          // setTotalTime({
          //   duration: durationNumber,
          //   unit: durationUnit,
          // });
        } else {
          if (onTestEnd) {
            // const results = await models.runnerTestResult.findByParentId(workspaceId) || [];
            // setTestHistory(results);
            // if (results.length > 0) {
            //   const latestResult = results[results.length - 1];
            //   setExecutionResult(latestResult);
            // }
            // setOnTestEnd(false);
          }
        }
      }
    };

    refreshPanes();
  }, 1000);

  // const { passedTestCount, totalTestCount, testResultCountTagColor } = useMemo(() => {
  //   let passedTestCount = 0;
  //   let totalTestCount = 0;

  //   if (!isRunning) {
  //     if (executionResult?.results) {
  //       executionResult.results.forEach(result => {
  //         if (result.status === 'passed') {
  //           passedTestCount++;
  //         }
  //         totalTestCount++;
  //       });
  //     }
  //   }

  //   const testResultCountTagColor = totalTestCount > 0 ?
  //     passedTestCount === totalTestCount ? 'bg-lime-600' : 'bg-red-600' :
  //     'bg-[var(--hl-sm)]';

  //   return { passedTestCount, totalTestCount, testResultCountTagColor };
  // }, [executionResult, isRunning]);

  const [selectedTab, setSelectedTab] = React.useState<Key>('test-results');
  // const gotoTestResultsTab = useCallback(() => {
  //   setSelectedTab('test-results');
  // }, [setSelectedTab]);

  const disabledKeys = useMemo(() => {
    return isRunning ? allKeys : [];
  }, [isRunning, allKeys]);

  return (
    <PanelGroup autoSaveId="insomnia-sidebar" id="wrapper" className='new-sidebar w-full h-full text-[--color-font]' direction='horizontal'>
      <Panel>
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>

          <Panel id="pane-one" className='pane-one theme--pane'>
            <ErrorBoundary showAlert>

              <Pane type="request">
                <PaneHeader>
                  <Heading className="flex items-center w-full h-[--line-height-sm] pl-[--padding-md]">
                    <div className="w-full text-left">
                      <span className="mr-6 text-sm">
                        <input
                          value={iterations}
                          name='Iterations'
                          disabled={isRunning}
                          onChange={e => {
                            try {
                              const iterCount = parseInt(e.target.value, 10);
                              if (iterCount > 0) {
                                setIterations(iterCount);
                              }
                            } catch (ex) {
                              // no op
                            }
                          }}
                          type='number'
                          className={iterationInputStyle}
                        />
                        <span className="border">Iterations</span>
                      </span>
                      <span className="mr-6 text-sm">
                        <input
                          value={delay}
                          disabled={isRunning}
                          name='Delay'
                          onChange={e => {
                            try {
                              const delay = parseInt(e.target.value, 10);
                              if (delay >= 0) {
                                setDelay(delay);
                              }
                            } catch (ex) {
                              // no op
                            }
                          }}
                          type='number'
                          className={inputStyle}
                        />
                        <span className="mr-1 border">Delay (ms)</span>
                      </span>
                      <span className="mr-6 text-sm">
                        <input
                          placeholder='Select file'
                          disabled={isRunning}
                          value={iterationFilePath?.path}
                          name='Data'
                          onClick={() => iterationDataInput.current?.click()}
                          type='text'
                          className={inputStyle}
                        />
                        <input
                          onChange={e => setIterationFilePath(e.currentTarget.files?.[0])}
                          type='file'
                          accept={[
                            '',
                            'csv',
                            'json',
                          ].join(',')}
                          ref={iterationDataInput}
                          style={{ display: 'none' }}
                        />
                        <span className="mr-1 border">Data</span>
                      </span>
                    </div>
                    <div className="w-[100px]">
                      <button
                        type="button"
                        className="rounded-sm text-center mr-1 bg-[--color-surprise] text-[--color-font-surprise]"
                        onClick={onRun}
                        style={{ width: '92px', height: '30px' }} // try to make its width same as "Send button"
                        disabled={isRunning}
                      >
                        Run
                      </button>
                    </div>
                  </Heading>
                </PaneHeader>
                <Tabs aria-label='Request group tabs' className="flex-1 w-full h-full flex flex-col">
                  <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
                    <Tab
                      className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                      id='request-order'
                    >
                      <i className="fa fa-sort fa-1x h-4 mr-2" />
                      Request Order
                    </Tab>
                    <Tab
                      className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                      id='advanced'
                    >
                      <i className="fa fa-gear fa-1x h-4 mr-2" />
                      Advanced
                    </Tab>
                  </TabList>
                  <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='request-order'>
                    <Toolbar className="w-full flex-shrink-0 h-[--line-height-sm] border-b border-solid border-[--hl-md] flex items-center px-2">
                      <span className="mr-2">
                        {
                          Array.from(reqList.selectedKeys).length === Array.from(reqList.items).length ?
                            <span onClick={onToggleSelection}><i style={{ color: 'rgb(74 222 128)' }} className="fa fa-square-check fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Unselect All</span></span> :
                            Array.from(reqList.selectedKeys).length === 0 ?
                              <span onClick={onToggleSelection}><i className="fa fa-square fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Select All</span></span> :
                              <span onClick={onToggleSelection}><i style={{ color: 'rgb(74 222 128)' }} className="fa fa-square-minus fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Select All</span></span>
                        }
                      </span>
                    </Toolbar>
                    <PaneBody placeholder className='p-0'>
                      <GridList
                        id="runner-request-list"
                        // style={{ height: virtualizer.getTotalSize() }}
                        items={reqList.items}
                        selectionMode="multiple"
                        selectedKeys={reqList.selectedKeys}
                        onSelectionChange={reqList.setSelectedKeys}
                        defaultSelectedKeys={allKeys}
                        aria-label="Request Collection"
                        dragAndDropHooks={requestsDnD}
                        className="w-full h-full leading-8 text-base overflow-auto"
                        disabledKeys={disabledKeys}
                      >
                        {item => {
                          const parentFolders = item.ancestorNames.map((parentFolderName: string, i: number) => {
                            // eslint-disable-next-line react/no-array-index-key
                            return <TooltipTrigger key={`parent-folder-${i}=${parentFolderName}`} >
                              <i className="fa fa-folder fa-1x h-4 mr-0.3 text-[--color-font]" />
                              <i className="fa fa-caret-right fa-1x h-4 mr-0.3 text-[--color-font]-50  opacity-50" />
                              <Tooltip message={parentFolderName}>
                                {''}
                              </Tooltip>
                            </TooltipTrigger>;
                          });
                          const parentFolderContainer = parentFolders.length > 0 ? <span className="ml-2">{parentFolders}</span> : null;

                          return (
                            <RequestItem className='text-[--color-font] border border-solid border-transparent' style={{ 'outline': 'none' }}>
                              {parentFolderContainer}
                              <span className={`ml-2 uppercase text-xs http-method-${item.method}`}>{item.method}</span>
                              <span className="ml-2 hover:underline cursor-pointer" style={{ color: 'white' }} onClick={() => goToRequest(item.id)}>{item.name}</span>
                            </RequestItem>
                          );
                        }}
                      </GridList>
                    </PaneBody>
                  </TabPanel>
                  <TabPanel className='w-full flex-1 flex align-center overflow-y-auto' id='advanced'>
                    <div className="p-4 w-full">
                      <Heading className="w-full text-lg text-white h-[--line-height-sm] border-solid scro border-b border-b-[--hl-md]">Advanced Settings</Heading>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            name='ignore-undefined-env'
                            onChange={() => { }}
                            type="checkbox"
                            disabled={isRunning}
                          />
                          Ignore undefined environments
                          <HelpTooltip className="space-left">Undefined environments will not be rendered for all requests.</HelpTooltip>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            name='persist-response'
                            onChange={() => { }}
                            type="checkbox"
                            disabled={isRunning}
                          />
                          Persist responses for a session
                          <HelpTooltip className="space-left">Enabling this will impact performance while responses are saved for other purposes.</HelpTooltip>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            name='log-off'
                            onChange={() => { }}
                            type="checkbox"
                            disabled={isRunning}
                          />
                          Turn off logs duration run
                          <HelpTooltip className="space-left">Disabling this will improve the performance while logs are not saved.</HelpTooltip>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            name='stop-on-error'
                            onChange={() => { }}
                            type="checkbox"
                            disabled={isRunning}
                          />
                          Stop run if an error occurs
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isRunning}
                          />
                          Keep variable values
                          <HelpTooltip className="space-left">Enabling this will persist generated values.</HelpTooltip>
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isRunning}
                          />
                          Run collection without using stored cookies
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isRunning}
                          />
                          Save cookies after collection run
                          <HelpTooltip className="space-left">Cookies in the running will be saved to the cookie manager.</HelpTooltip>
                        </label>
                      </div>
                    </div>
                  </TabPanel>
                </Tabs>
              </Pane>
            </ErrorBoundary>
          </Panel>
          <PanelResizeHandle className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'w-full h-[1px] bg-[--hl-md]'} />
          <Panel id="pane-two" className='pane-two theme--pane'>
            <PaneHeader className="row-spaced">
              <Heading className="flex items-center w-full h-[--line-height-sm] pl-3 border-solid scro border-b border-b-[--hl-md]">
                {/* {
                  executionResult?.duration ?
                    <div className="bg-info tag" >
                      <strong>{`${totalTime.duration} ${totalTime.unit}`}</strong>
                    </div> :
                    <span className="font-bold">Collection Runner</span>
                } */}
              </Heading>
            </PaneHeader>
            <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab} aria-label='Request group tabs' className="flex-1 w-full h-full flex flex-col">
              <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
                <Tab
                  className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                  id='test-results'
                >
                  <div>
                    <span>
                      Tests
                    </span>
                    {/* <span
                      className={`rounded-sm ml-1 px-1 ${testResultCountTagColor}`}
                      style={{ color: 'white' }}
                    >
                      {`${passedTestCount} / ${totalTestCount}`}
                    </span> */}
                  </div>
                </Tab>
                <Tab
                  className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                  id='history'
                >
                  History
                </Tab>
                <Tab
                  className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                  id='console'
                >
                  Console
                </Tab>
              </TabList>
              <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='console'>
                <></>
              </TabPanel>
              <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='history'>
                {/* <RunnerResultHistoryPane history={testHistory} gotoExecutionResult={gotoExecutionResult} gotoTestResultsTab={gotoTestResultsTab} /> */}
              </TabPanel>
              <TabPanel
                className='w-full flex-1 flex flex-col overflow-y-auto'
                id='test-results'
              >
                {isRunning &&
                  <div className="h-full w-full text-md flex items-center">
                    <ResponseTimer
                      handleCancel={() => { }}
                      activeRequestId={workspaceId}
                      steps={timingSteps}
                    />
                  </div>
                }
                {/* {!isRunning && <ErrorBoundary showAlert><RequestTestResultPane requestTestResults={executionResult?.results || []} /></ErrorBoundary>} */}
              </TabPanel>
            </Tabs>

          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

export default Runner;

const RequestItem = (
  { children, ...props }: GridListItemProps
) => {

  return (
    <GridListItem {...props}>
      {() => (
        <>
          <Button slot="drag" className="hover:cursor-grab">
            <Icon icon="grip-vertical" className='w-2 text-[--hl] mr-2' />
          </Button>
          <Checkbox slot="selection">
            {({ isSelected }) => {
              return <>
                {isSelected ?
                  <i className="fa fa-square-check fa-1x h-4 mr-2" style={{ color: 'rgb(74 222 128)' }} /> :
                  <i className="fa fa-square fa-1x h-4 mr-2" />
                }
              </>;
            }}
          </Checkbox>
          {children}
        </>
      )}
    </GridListItem>
  );
};

export interface runCollectionActionParams {
  requests: { id: string; name: string }[];
}

export const runCollectionAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'Organization id is required');
  invariant(projectId, 'Project id is required');
  invariant(workspaceId, 'Workspace id is required');
  const { requests, iterations, delay } = await request.json();
  const source: RunnerSource = 'runner';

  let testCtx = {
    source,
    environmentId: '',
    iterations,
    iterationData: {},
    duration: 1, // TODO: disable this
    testCount: 0,
    avgRespTime: 0,
    results: new Array<RequestTestResult>(),
    done: false,
  };

  window.main.startExecution({ requestId: workspaceId });
  window.main.addExecutionStep({
    requestId: workspaceId,
    stepName: 'Initializing',
  });

  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < requests.length; j++) {
      const targetRequest = requests[j];
      window.main.updateLatestStepName({ requestId: workspaceId, stepName: `Executing ${j + 1} of ${requests.length} requests - "${targetRequest.name}"` });

      const activeRequestMeta = await models.requestMeta.updateOrCreateByParentId(
        targetRequest.id,
        { lastActive: Date.now() },
      );
      invariant(activeRequestMeta, 'Request meta not found');

      await new Promise(resolve => setTimeout(resolve, delay));
      const resultCollector = {
        requestId: targetRequest.id,
        requestName: targetRequest.name,
        requestUrl: targetRequest.url,
        responseReason: '',
        duration: 1,
        size: 0,
        results: new Array<RequestTestResult>(),
      };
      await sendActionImp({
        requestId: targetRequest.id,
        workspaceId,
        shouldPromptForPathAfterResponse: false,
        ignoreUndefinedEnvVariable: true,
        testResultCollector: resultCollector,
      });

      testCtx = {
        ...testCtx,
        duration: testCtx.duration + resultCollector.duration,
        results: [...testCtx.results, ...resultCollector.results],
      };
    }
  }
  window.main.updateLatestStepName({ requestId: workspaceId, stepName: 'Done' });
  window.main.completeExecutionStep({ requestId: workspaceId });

  // await models.runnerTestResult.create({
  //     parentId: workspaceId,
  //     source: 'runner',
  //     // environmentId: string;
  //     iterations: testCtx.iterations,
  //     duration: testCtx.duration,
  //     avgRespTime: testCtx.duration / requests.length,
  //     results: testCtx.results,
  // });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner?test-end`);
};

export const collectionRunnerStatusLoader: ActionFunction = async ({ params }) => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace id is required');

  // const status = getCollectionRunnerStatus(workspaceId);
  // return { ...status };
  return null;
};
