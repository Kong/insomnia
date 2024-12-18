import { type RequestContext } from 'insomnia-sdk';
import porderedJSON from 'json-order';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, DropIndicator, GridList, GridListItem, type GridListItemProps, Heading, type Key, Tab, TabList, TabPanel, Tabs, Toolbar, TooltipTrigger, useDragAndDrop } from 'react-aria-components';
import { Panel, PanelResizeHandle } from 'react-resizable-panels';
import { type ActionFunction, type LoaderFunction, useNavigate, useParams, useRouteLoaderData, useSearchParams, useSubmit } from 'react-router-dom';
import { useInterval } from 'react-use';
import { v4 as uuidv4 } from 'uuid';

import { Tooltip } from '../../../src/ui/components/tooltip';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '../../common/constants';
import type { ResponseTimelineEntry } from '../../main/network/libcurl-promise';
import type { TimingStep } from '../../main/network/request-timing';
import * as models from '../../models';
import type { UserUploadEnvironment } from '../../models/environment';
import type { RunnerResultPerRequest, RunnerTestResult } from '../../models/runner-test-result';
import { cancelRequestById } from '../../network/cancellation';
import { moveAfter, moveBefore } from '../../utils';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';
import { Dropdown, DropdownItem, ItemContent } from '../components/base/dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { HelpTooltip } from '../components/help-tooltip';
import { Icon } from '../components/icon';
import { showAlert } from '../components/modals';
import { CLIPreviewModal } from '../components/modals/cli-preview-modal';
import { UploadDataModal, type UploadDataType } from '../components/modals/upload-runner-data-modal';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';
import { RunnerResultHistoryPane } from '../components/panes/runner-result-history-pane';
import { RunnerTestResultPane } from '../components/panes/runner-test-result-pane';
import { ResponseTimer } from '../components/response-timer';
import { getTimeAndUnit } from '../components/tags/time-tag';
import { ResponseTimelineViewer } from '../components/viewers/response-timeline-viewer';
import { useRunnerContext } from '../context/app/runner-context';
import { useRunnerRequestList } from '../hooks/use-runner-request-list';
import type { OrganizationLoaderData } from './organization';
import { type CollectionRunnerContext, defaultSendActionRuntime, type RunnerSource, sendActionImplementation } from './request';
import { useRootLoaderData } from './root';

const inputStyle = 'placeholder:italic py-0.5 mr-1.5 px-1 w-24 rounded-sm border-2 border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors';
const iterationInputStyle = 'placeholder:italic py-0.5 mr-1.5 px-1 w-16 rounded-sm border-2 border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors';

// TODO: improve the performance for a lot of logs
async function aggregateAllTimelines(errorMsg: string | null, testResult: RunnerTestResult) {
  let timelines = new Array<ResponseTimelineEntry>();
  const responsesInfo = testResult.responsesInfo;

  for (let i = 0; i < responsesInfo.length; i++) {
    const respInfo = responsesInfo[i];
    const resp = await models.response.getById(respInfo.responseId);

    if (resp) {
      const timeline = models.response.getTimeline(resp, true) as unknown as ResponseTimelineEntry[];
      timelines = [
        ...timelines,
        {
          value: `------ Start of request (${respInfo.originalRequestName}) ------`,
          name: 'Text',
          timestamp: Date.now(),
        },
        ...timeline,
      ];
    } else {
      timelines = [
        ...timelines,
        {
          value: `------ Start of request (${respInfo.originalRequestName}) ------`,
          name: 'Text',
          timestamp: Date.now(),
        },
        {
          value: `failed to read response for the request ${respInfo.originalRequestName}`,
          name: 'Text',
          timestamp: Date.now(),
        },
      ];
    }
  }

  if (errorMsg) {
    timelines = [
      ...timelines,
      {
        value: errorMsg,
        name: 'Text',
        timestamp: Date.now(),
      },
    ];
  }

  return timelines;
}

export const repositionInArray = (allItems: string[], itemsToMove: string[], targetIndex: number) => {
  let items = allItems;
  for (const key of itemsToMove) {
    const removed = items.filter(item => item !== key);
    items = [...removed.slice(0, targetIndex), key.toString(), ...removed.slice(targetIndex)];
  }
  return items;
};

export interface RequestRow {
  id: string;
  name: string;
  ancestorNames: string[];
  ancestorIds: string[];
  method: string;
  url: string;
  parentId: string;
};

const defaultAdvancedConfig = {
  bail: true,
  keepLog: true,
};

export const Runner: FC<{}> = () => {
  const [searchParams] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<null | string>(null);

  const { currentPlan } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const targetFolderId = searchParams.get('folder') || '';

  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    direction: 'vertical' | 'horizontal';
  };
  const [isRunning, setIsRunning] = useState(false);

  // For backward compatibility，the runnerId we use for testResult in database is no prefix with 'runner_'
  const runnerId = targetFolderId ? targetFolderId : workspaceId;

  const { settings } = useRootLoaderData();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCLIModal, setShowCLIModal] = useState(false);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(settings.forceVerticalLayout ? 'vertical' : 'horizontal');

  const { runnerStateMap, updateRunnerState } = useRunnerContext();
  const { iterationCount = 1, delay = 0, selectedKeys = new Set<Key>(), advancedConfig = defaultAdvancedConfig, uploadData = [], file } = runnerStateMap?.[organizationId]?.[runnerId] || {};
  invariant(iterationCount, 'iterationCount should not be null');

  const { reqList, requestRows, entityMap } = useRunnerRequestList(organizationId, targetFolderId, runnerId);

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

  const isConsistencyChanged = useMemo(() => {
    if (requestRows.length !== reqList.length) {
      return true;
    } else if (selectedKeys !== 'all' && Array.from(selectedKeys).length !== requestRows.length) {
      return true;
    }

    return requestRows.some((row: RequestRow, index: number) => row.id !== reqList[index].id);
  }, [reqList, requestRows, selectedKeys]);

  const { dragAndDropHooks: requestsDnD } = useDragAndDrop({
    getItems: keys => {
      return [...keys].map(key => {
        const name = entityMap.get(key as string)?.doc.name || '';
        return {
          'text/plain': key.toString(),
          name,
        };
      });
    },
    onReorder: event => {
      let newList = reqList;
      if (event.target.dropPosition === 'before') {
        newList = moveBefore(reqList, event.target.key, event.keys);
      } else if (event.target.dropPosition === 'after') {
        newList = moveAfter(reqList, event.target.key, event.keys);
      }
      updateRunnerState(organizationId, runnerId, { reqList: newList });
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
        const item = reqList.find(item => item.id === target.key);
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
    if (isRunning) {
      return;
    }
    setIsRunning(true);

    window.main.trackSegmentEvent({ event: SegmentEvent.collectionRunExecute, properties: { plan: currentPlan?.type || 'scratchpad', iterations: iterationCount } });

    const requests = selectedKeys === 'all'
      ? reqList
      : reqList.filter(item => (selectedKeys as Set<Key>).has(item.id));

    // convert uploadData to environment data
    const userUploadEnvs = uploadData.map(data => {
      const orderedJson = porderedJSON.parse<UploadDataType>(
        JSON.stringify(data || []),
        JSON_ORDER_PREFIX,
        JSON_ORDER_SEPARATOR,
      );
      return {
        name: file!.name,
        data: orderedJson.object,
        dataPropertyOrder: orderedJson.map || null,
      };
    });
    const actionInput: runCollectionActionParams = {
      requests,
      iterationCount,
      userUploadEnvs,
      delay,
      bail: advancedConfig?.bail,
      keepLog: advancedConfig?.keepLog,
      targetFolderId: targetFolderId || '',
    };
    submit(
      JSON.stringify(actionInput),
      {
        method: 'post',
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner/run`,
        navigate: false,
      }
    );
  };

  const navigate = useNavigate();
  const goToRequest = (requestId: string) => {
    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}`);
  };
  const onToggleSelection = () => {
    if (selectedKeys === 'all' || Array.from(selectedKeys).length === Array.from(reqList).length) {
      // unselect all
      updateRunnerState(organizationId, runnerId, { selectedKeys: new Set([]) });
    } else {
      // select all
      const allKeys = reqList.map(item => item.id);
      updateRunnerState(organizationId, runnerId, { selectedKeys: new Set(allKeys) });
    }
  };

  const [testHistory, setTestHistory] = useState<RunnerTestResult[]>([]);
  useEffect(() => {
    const readResults = async () => {
      const results = await models.runnerTestResult.findByParentId(runnerId) || [];
      setTestHistory(results.reverse());
    };
    readResults();
  }, [runnerId]);

  const [timingSteps, setTimingSteps] = useState<TimingStep[]>([]);
  const [totalTime, setTotalTime] = useState({
    duration: 0,
    unit: 'ms',
  });

  const [executionResult, setExecutionResult] = useState<RunnerTestResult | null>(null);
  const [timelines, setTimelines] = useState<ResponseTimelineEntry[]>([]);
  const gotoExecutionResult = useCallback(async (executionId: string) => {
    const result = await models.runnerTestResult.getById(executionId);
    if (result) {
      setExecutionResult(result);
    }
  }, [setExecutionResult]);

  useEffect(() => {
    const refreshTimeline = async () => {
      if (executionResult) {
        const mergedTimelines = await aggregateAllTimelines(errorMsg, executionResult);
        setTimelines(mergedTimelines);
      } else {
        setTimelines([]);
      }
    };
    refreshTimeline();
  }, [executionResult, errorMsg]);

  const showErrorAlert = (error: string) => {
    showAlert({
      title: 'Unexpected Runner Failure',
      message: (
        <div>
          <p>The runner failed due to an unhandled error:</p>
          <code className="wide selectable">
            <pre>{error}</pre>
          </code>
        </div>
      ),
    });
  };

  const refreshPanes = useCallback(async () => {
    const latestTimingSteps = await window.main.getExecution({ requestId: runnerId });
    let isRunning = false;
    if (latestTimingSteps) {
    // there is a timingStep item and it is not ended (duration is not assigned)
      isRunning = latestTimingSteps.length > 0 && latestTimingSteps[latestTimingSteps.length - 1].stepName !== 'Done';
    }
    setIsRunning(isRunning);

    if (isRunning) {
      const duration = Date.now() - latestTimingSteps[latestTimingSteps.length - 1].startedAt;
      const { number: durationNumber, unit: durationUnit } = getTimeAndUnit(duration);
      setTimingSteps(latestTimingSteps);
      setTotalTime({
        duration: durationNumber,
        unit: durationUnit,
      });
    } else {
      const results = await models.runnerTestResult.findByParentId(runnerId) || [];
      // show execution result
      if (results.length > 0) {
        setTestHistory(results.reverse());
        const latestResult = results[0];
        setExecutionResult(latestResult);
        const { error } = getExecution(runnerId);
        if (error) {
          setErrorMsg(error);
          showErrorAlert(error);
          updateExecution(runnerId, { error: '' });
        }
      } else {
        // show initial empty panel
        setExecutionResult(null);
        setErrorMsg(null);
      }
    }
  }, [runnerId]);

  useInterval(() => {
    refreshPanes();
  }, isRunning ? 1000 : null);

  useEffect(() => {
    refreshPanes();
  }, [refreshPanes]);

  const { passedTestCount, totalTestCount, testResultCountTagColor } = useMemo(() => {
    let passedTestCount = 0;
    let totalTestCount = 0;

    if (!isRunning) {
      if (executionResult?.iterationResults) {
        for (let i = 0; i < executionResult.iterationResults.length; i++) { // iterations
          for (let j = 0; j < executionResult.iterationResults[i].length; j++) { // requests
            for (let k = 0; k < executionResult.iterationResults[i][j].results.length; k++) { // test cases
              if (executionResult.iterationResults[i][j].results[k].status === 'passed') {
                passedTestCount++;
              }
              totalTestCount++;
            }
          }
        }
      }
    }

    const testResultCountTagColor = totalTestCount > 0 ?
      passedTestCount === totalTestCount ? 'bg-lime-600' : 'bg-red-600' :
      'bg-[var(--hl-sm)]';

    return { passedTestCount, totalTestCount, testResultCountTagColor };
  }, [executionResult, isRunning]);

  const [selectedTab, setSelectedTab] = React.useState<Key>('test-results');
  const gotoTestResultsTab = useCallback(() => {
    setSelectedTab('test-results');
  }, [setSelectedTab]);

  const allKeys = reqList.map(item => item.id);
  const disabledKeys = useMemo(() => {
    return isRunning ? allKeys : [];
  }, [isRunning, allKeys]);
  const isDisabled = isRunning || Array.from(selectedKeys).length === 0;

  const [deletedItems, setDeletedItems] = useState<string[]>([]);
  const deleteHistoryItem = (item: RunnerTestResult) => {
    models.runnerTestResult.remove(item);
    setDeletedItems([...deletedItems, item._id]);
  };

  const selectedRequestIdsForCliCommand =
    targetFolderId !== null && targetFolderId !== ''
      ? reqList
        .filter(item => item.ancestorIds.includes(targetFolderId))
        .map(item => item.id)
        .filter(id => selectedKeys === 'all' || selectedKeys.has(id))
      : reqList
        .map(item => item.id)
        .filter(id => selectedKeys === 'all' || selectedKeys.has(id));

  return (
    <>
      <Panel id="pane-one" className='pane-one theme--pane' minSize={35} maxSize={90}>
        <ErrorBoundary showAlert>

          <Pane type="request">
            <PaneHeader>
              <Heading className="flex items-center w-full h-[--line-height-sm] pl-[--padding-md]">
                <div className="w-full h-full text-left overflow-hidden">
                  <div className="h-full min-w-[500px]">
                    <span className="mr-6 text-sm">
                      <input
                        value={iterationCount}
                        name='Iterations'
                        disabled={isRunning}
                        onChange={e => {
                          try {
                            if (parseInt(e.target.value, 10) > 0) {
                              updateRunnerState(organizationId, runnerId, { iterationCount: parseInt(e.target.value, 10) });
                            }
                          } catch (ex) { }
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
                              updateRunnerState(organizationId, runnerId, { delay }); // also update the temp settings
                            }
                          } catch (ex) { }
                        }}
                        type='number'
                        className={inputStyle}
                      />
                      <span className="mr-1 border">Delay (ms)</span>
                    </span>
                    <Button
                      onPress={() => setShowUploadModal(true)}
                      className="py-0.5 px-1 border-[--hl-sm] h-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] ring-1 ring-transparent transition-all text-sm mr-6"
                      isDisabled={isRunning}
                    >
                      <Icon icon={file ? 'eye' : 'upload'} /> {file ? 'View Data' : 'Upload Data'}
                    </Button>
                  </div>
                </div>
                <div className='flex p-1 self-stretch'>
                  <Button
                    isDisabled={isDisabled}
                    className="px-5 ml-1 text-[--color-font-surprise] bg-[--color-surprise] hover:bg-opacity-90 focus:bg-opacity-90 rounded-l-sm"
                    onPress={onRun}
                  >
                    Run
                  </Button>
                  <Dropdown
                    key="dropdown"
                    className="flex"
                    isDisabled={isDisabled}
                    aria-label="Run Options"
                    closeOnSelect={false}
                    triggerButton={
                      <Button
                        isDisabled={isDisabled}
                        className="px-1 bg-[--color-surprise] text-[--color-font-surprise] rounded-r-sm"
                        style={{
                          borderTopRightRadius: '0.125rem',
                          borderBottomRightRadius: '0.125rem',
                        }}
                      >
                        <i className="fa fa-caret-down" />
                      </Button>
                    }
                  >

                    <DropdownItem aria-label="send-now">
                      <ItemContent icon="arrow-circle-o-right" label="Run" onClick={onRun} />
                    </DropdownItem>
                    <DropdownItem aria-label='Run via CLI'>
                      <ItemContent
                        icon="code"
                        label="Run via CLI"
                        onClick={() => setShowCLIModal(true)}
                      />
                    </DropdownItem>
                  </Dropdown>
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
                      (selectedKeys === 'all' || Array.from(selectedKeys).length === Array.from(reqList).length) ?
                        <span onClick={onToggleSelection}><i style={{ color: 'rgb(74 222 128)' }} className="fa fa-square-check fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Unselect All</span></span> :
                        Array.from(selectedKeys).length === 0 ?
                          <span onClick={onToggleSelection}><i className="fa fa-square fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Select All</span></span> :
                          <span onClick={onToggleSelection}><i style={{ color: 'rgb(74 222 128)' }} className="fa fa-square-minus fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Select All</span></span>
                    }
                  </span>
                </Toolbar>
                <PaneBody placeholder className='p-0'>
                  <GridList
                    id="runner-request-list"
                    items={reqList}
                    selectionMode="multiple"
                    selectedKeys={selectedKeys}
                    onSelectionChange={keys => {
                      updateRunnerState(organizationId, runnerId, { selectedKeys: keys });
                    }}
                    aria-label="Request Collection"
                    dragAndDropHooks={requestsDnD}
                    className="w-full h-full leading-8 text-base overflow-auto"
                    disabledKeys={disabledKeys}
                  >
                    {item => {
                      const parentFolders = item.ancestorNames.map((parentFolderName: string, i: number) => {
                        // eslint-disable-next-line react/no-array-index-key
                        return <TooltipTrigger key={`parent-folder-${i}=${parentFolderName}`} >
                          <Tooltip message={parentFolderName}>
                            <i className="fa fa-folder fa-1x h-4 mr-0.3 text-[--color-font]" />
                            <i className="fa fa-caret-right fa-1x h-4 mr-0.3 text-[--color-font]-50  opacity-50" />
                          </Tooltip>
                        </TooltipTrigger>;
                      });
                      const parentFolderContainer = parentFolders.length > 0 ? <span className="ml-2">{parentFolders}</span> : null;

                      return (
                        <RequestItem textValue={item.name} className={`runner-request-list-${item.name} text-[--color-font] border border-solid border-transparent`} style={{ 'outline': 'none' }}>
                          {parentFolderContainer}
                          <span className={`ml-2 uppercase text-xs http-method-${item.method}`}>{item.method}</span>
                          <span className="ml-2 hover:underline cursor-pointer text-[--hl]" onClick={() => goToRequest(item.id)}>{item.name}</span>
                        </RequestItem>
                      );
                    }}
                  </GridList>
                </PaneBody>
              </TabPanel>
              <TabPanel className='w-full flex-1 flex align-center overflow-y-auto' id='advanced'>
                <div className="p-4 w-full">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        name='persist-response'
                        onChange={() => { }}
                        type="checkbox"
                        disabled={true}
                      />
                      Persist responses for a session
                      <HelpTooltip className="space-left">Enabling this will impact performance while responses are saved for other purposes.</HelpTooltip>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        name='enable-log'
                        onChange={() => {
                          updateRunnerState(organizationId, runnerId, {
                            advancedConfig: {
                              ...advancedConfig,
                              keepLog: !advancedConfig?.keepLog,
                            },
                          });
                        }}
                        type="checkbox"
                        disabled={isRunning}
                        checked={advancedConfig?.keepLog}
                      />
                      Keep logs after run
                      <HelpTooltip className="space-left">Disabling this will improve the performance while logs are not saved.</HelpTooltip>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        name='bail'
                        onChange={() => {
                          updateRunnerState(organizationId, runnerId, {
                            advancedConfig: {
                              ...advancedConfig,
                              bail: !advancedConfig?.bail,
                            },
                          });
                        }}
                        type="checkbox"
                        disabled={isRunning}
                        checked={advancedConfig?.bail}
                      />
                      Stop run if an error occurs
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={true}
                        checked
                      />
                      Keep variable values
                      <HelpTooltip className="space-left">Enabling this will persist generated values.</HelpTooltip>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={true}
                      />
                      Run collection without using stored cookies
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={true}
                        checked
                      />
                      Save cookies after collection run
                      <HelpTooltip className="space-left">Cookies in the running will be saved to the cookie manager.</HelpTooltip>
                    </label>
                  </div>
                </div>
              </TabPanel>
            </Tabs>
            {showCLIModal && (
              <CLIPreviewModal
                onClose={() => setShowCLIModal(false)}
                requestIds={selectedRequestIdsForCliCommand}
                targetFolderId={targetFolderId}
                keepManualOrder={!isConsistencyChanged}
                iterationCount={iterationCount}
                delay={delay}
                filePath={file?.path || ''}
                bail={advancedConfig?.bail}
              />
            )}
            {showUploadModal && (
              <UploadDataModal
                onUploadFile={(file, uploadData) => {
                  updateRunnerState(organizationId, runnerId, {
                    uploadData,
                    file,
                    iterationCount: uploadData.length >= 1 ? uploadData.length : iterationCount,
                  });
                }}
                userUploadData={uploadData}
                onClose={() => setShowUploadModal(false)}
              />
            )}
          </Pane>
        </ErrorBoundary>
      </Panel>
      <PanelResizeHandle className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'w-full h-[1px] bg-[--hl-md]'} />
      <Panel id="pane-two" className='pane-two theme--pane'>
        <PaneHeader className="row-spaced">
          <Heading className="flex items-center w-full h-[--line-height-sm] pl-3 border-solid scro border-b border-b-[--hl-md]">
            {
              executionResult?.duration ?
                <div className="bg-info tag" >
                  <strong>{`${totalTime.duration} ${totalTime.unit}`}</strong>
                </div> :
                <span className="font-bold">Collection Runner</span>
            }
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
                <span
                  className={`test-result-count rounded-sm ml-1 px-1 ${testResultCountTagColor}`}
                  style={{ color: 'white' }}
                >
                  {`${passedTestCount} / ${totalTestCount}`}
                </span>
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
            <ResponseTimelineViewer
              key={runnerId}
              timeline={timelines}
            />
          </TabPanel>
          <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='history'>
            <RunnerResultHistoryPane
              history={testHistory.filter(item => !deletedItems.includes(item._id))}
              gotoExecutionResult={gotoExecutionResult}
              gotoTestResultsTab={gotoTestResultsTab}
              deleteHistoryItem={deleteHistoryItem}
            />
          </TabPanel>
          <TabPanel
            className='w-full flex-1 flex flex-col overflow-y-auto'
            id='test-results'
          >
            {isRunning &&
              <div className="h-full w-full text-md flex items-center">
                <ResponseTimer
                  handleCancel={() => cancelExecution(runnerId)}
                  activeRequestId={runnerId}
                  steps={timingSteps}
                />
              </div>
            }
            {!isRunning && <ErrorBoundary showAlert><RunnerTestResultPane result={executionResult} /></ErrorBoundary>}
          </TabPanel>
        </Tabs>

      </Panel>
    </>
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

// This is required for tracking the active request for one runner execution
// Then in runner cancellation, both the active request and the runner execution will be canceled
// TODO(george): Potentially it could be merged with maps in request-timing.ts and cancellation.ts
interface ExecutionInfo {
  activeRequestId?: string;
  error?: string;
};
const runnerExecutions = new Map<string, ExecutionInfo>();
function startExecution(workspaceId: string) {
  runnerExecutions.set(workspaceId, {});
}

function updateExecution(workspaceId: string, executionInfo: ExecutionInfo) {
  const info = runnerExecutions.get(workspaceId);
  runnerExecutions.set(workspaceId, {
    ...info,
    ...executionInfo,
  });
}

function getExecution(workspaceId: string) {
  return runnerExecutions.get(workspaceId) || {};
}

function cancelExecution(workspaceId: string) {
  const { activeRequestId } = getExecution(workspaceId);
  if (activeRequestId) {
    cancelRequestById(activeRequestId);
    window.main.completeExecutionStep({ requestId: activeRequestId });
    window.main.updateLatestStepName({ requestId: workspaceId, stepName: 'Done' });
    window.main.completeExecutionStep({ requestId: workspaceId });
  }
}
const wrapAroundIterationOverIterationData = (list?: UserUploadEnvironment[], currentIteration?: number): UserUploadEnvironment | undefined => {
  if (currentIteration === undefined || !Array.isArray(list) || list.length === 0) {
    return undefined;
  }
  if (list.length >= currentIteration + 1) {
    return list[currentIteration];
  };
  return list[(currentIteration + 1) % list.length];
};
export interface runCollectionActionParams {
  requests: RequestRow[];
  iterationCount: number;
  delay: number;
  userUploadEnvs: UserUploadEnvironment[];
  bail: boolean;
  keepLog: boolean;
  targetFolderId: string;
}

// don't forget also apply modification on this function to the cli.ts at the moment
export const runCollectionAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'Organization id is required');
  invariant(projectId, 'Project id is required');
  invariant(workspaceId, 'Workspace id is required');

  const { requests, iterationCount, delay, userUploadEnvs, bail, targetFolderId, keepLog } = await request.json() as runCollectionActionParams;
  const source: RunnerSource = 'runner';
  const runnerId = targetFolderId ? targetFolderId : workspaceId;

  let testCtx: CollectionRunnerContext = {
    source,
    environmentId: '',
    iterationCount,
    iterationData: userUploadEnvs,
    duration: 0,
    testCount: 0,
    avgRespTime: 0,
    iterationResults: [],
    done: false,
    responsesInfo: [],
    transientVariables: {
      ...models.environment.init(),
      _id: uuidv4(),
      type: models.environment.type,
      parentId: '',
      modified: 0,
      created: Date.now(),
      name: 'Transient Variables',
      data: {},
    },
  };

  window.main.startExecution({ requestId: runnerId });
  window.main.addExecutionStep({
    requestId: runnerId,
    stepName: 'Initializing',
  });
  startExecution(runnerId);

  const noLogRuntime = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    appendTimeline: async (_timelinePath: string, _logs: string[]) => { }, // no op
  };

  try {
    const runtime = keepLog ? defaultSendActionRuntime : noLogRuntime;

    for (let i = 0; i < iterationCount; i++) {
      // nextRequestIdOrName is used to manual set next request in iteration from pre-request script
      let nextRequestIdOrName = '';

      let testResultsForOneIteration: RunnerResultPerRequest[] = [];

      let j = 0;
      while (j < requests.length) {
        // TODO: we might find a better way to do runner cancellation
        if (getExecution(runnerId) === undefined) {
          throw 'Runner has been stopped';
        }

        const targetRequest = requests[j];
        const resultCollector = {
          requestId: targetRequest.id,
          requestName: targetRequest.name,
          requestUrl: targetRequest.url,
          statusCode: 0,
          duration: 0,
          size: 0,
          results: [],
          responseId: '',
        };

        const isNextRequest = (targetRequest: RequestRow, nextRequestIdOrName: string) => {
          const matchId = targetRequest.id === nextRequestIdOrName;
          const matchName = targetRequest.name.trim() === nextRequestIdOrName.trim();
          // find the last request with matched name in case multiple requests with same name in collection runner
          const matchLastIndex = j === requests.findLastIndex(req => req.name.trim() === nextRequestIdOrName.trim());

          return matchId || (matchName && matchLastIndex);
        };

        try {
          if (nextRequestIdOrName !== '') {
            if (isNextRequest(targetRequest, nextRequestIdOrName)) {
              // reset nextRequestIdOrName when request name or id meets;
              nextRequestIdOrName = '';
            } else {
              continue;
            }
          }

          updateExecution(runnerId, {
            activeRequestId: targetRequest.id,
          });
          window.main.updateLatestStepName({
            requestId: runnerId,
            stepName: `Iteration ${i + 1} - Executing ${j + 1} of ${requests.length} requests - "${targetRequest.name}"`,
          });

          const activeRequestMeta = await models.requestMeta.updateOrCreateByParentId(
            targetRequest.id,
            { lastActive: Date.now() },
          );
          invariant(activeRequestMeta, 'Request meta not found');

          await new Promise(resolve => setTimeout(resolve, delay));

          const mutatedContext = await sendActionImplementation({
            requestId: targetRequest.id,
            iteration: i + 1,
            iterationCount,
            userUploadEnvironment: wrapAroundIterationOverIterationData(userUploadEnvs, i),
            shouldPromptForPathAfterResponse: false,
            ignoreUndefinedEnvVariable: true,
            testResultCollector: resultCollector,
            runtime,
            transientVariables: testCtx.transientVariables,
          }) as RequestContext | null;
          if (mutatedContext?.execution?.nextRequestIdOrName) {
            nextRequestIdOrName = mutatedContext.execution.nextRequestIdOrName || '';
          };

          const requestResults: RunnerResultPerRequest = {
            requestName: targetRequest.name,
            requestUrl: targetRequest.url,
            responseCode: resultCollector.statusCode,
            results: resultCollector.results,
          };

          testResultsForOneIteration = [...testResultsForOneIteration, requestResults];
          testCtx = {
            ...testCtx,
            duration: testCtx.duration + resultCollector.duration,
            responsesInfo: [
              ...testCtx.responsesInfo,
              {
                responseId: resultCollector.responseId,
                originalRequestId: targetRequest.id,
                originalRequestName: targetRequest.name,
              },
            ],
          };

        } catch (e) {
          const requestResults: RunnerResultPerRequest = {
            requestName: targetRequest.name,
            requestUrl: targetRequest.url,
            responseCode: resultCollector.statusCode,
            results: resultCollector.results,
          };

          testResultsForOneIteration = [...testResultsForOneIteration, requestResults];
          testCtx = {
            ...testCtx,
            responsesInfo: [
              ...testCtx.responsesInfo,
              {
                // this is ok and timeline will display an error
                responseId: resultCollector.responseId || '',
                originalRequestId: targetRequest.id,
                originalRequestName: targetRequest.name,
              },
            ],
          };
          if (bail) {
            // save previous results in this iteration
            testCtx = {
              ...testCtx,
              iterationResults: [...testCtx.iterationResults, testResultsForOneIteration],
            };
            throw e;
          }
          // or continue execution if needed
          nextRequestIdOrName = ''; // ignore it if there's an exception to avoid infinite loop
        } finally {
          if (isNextRequest(targetRequest, nextRequestIdOrName)) {
            // it points the next request to itself so keep the current j
          } else {
            j++;
          }
        }
      }

      testCtx = {
        ...testCtx,
        iterationResults: [...testCtx.iterationResults, testResultsForOneIteration],
      };
    }

    window.main.updateLatestStepName({ requestId: runnerId, stepName: 'Done' });
    window.main.completeExecutionStep({ requestId: runnerId });
  } catch (e) {
    // the error could be from third party
    const errMsg = e.error || e;
    updateExecution(runnerId, {
      error: errMsg,
    });
    return null;
  } finally {
    cancelExecution(runnerId);

    await models.runnerTestResult.create({
      parentId: runnerId,
      source: testCtx.source,
      iterations: testCtx.iterationCount,
      duration: testCtx.duration,
      avgRespTime: testCtx.avgRespTime,
      iterationResults: testCtx.iterationResults,
      responsesInfo: testCtx.responsesInfo,
    });
  }
  return null;
};

export const collectionRunnerStatusLoader: LoaderFunction = async ({ params }) => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace id is required');
  return null;
};
