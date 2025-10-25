import porderedJSON from 'json-order';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  DropIndicator,
  GridList,
  GridListItem,
  Heading,
  type Key,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Toolbar,
  TooltipTrigger,
  useDragAndDrop,
} from 'react-aria-components';
import { Panel, PanelResizeHandle } from 'react-resizable-panels';
import { href, useNavigate, useParams, useSearchParams, useSubmit } from 'react-router';
import * as reactUse from 'react-use';
import { v4 as uuidv4 } from 'uuid';

import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from '~/common/constants';
import type { ResponseTimelineEntry } from '~/main/network/libcurl-promise';
import type { TimingStep } from '~/main/network/request-timing';
import * as models from '~/models';
import type { ComparisonResult } from '~/models/comparison-result';
import type { Environment } from '~/models/environment';
import type { UserUploadEnvironment } from '~/models/environment';
import type { RunnerResultPerRequest, RunnerTestResult } from '~/models/runner-test-result';
import { cancelRequestById } from '~/network/cancellation';
import { defaultSendActionRuntime } from '~/network/network';
import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import type { CollectionRunnerContext } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send';
import { sendActionImplementation } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.send';
import { SegmentEvent } from '~/ui/analytics';
import { Dropdown, DropdownItem, ItemContent } from '~/ui/components/base/dropdown';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { HelpTooltip } from '~/ui/components/help-tooltip';
import { Icon } from '~/ui/components/icon';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { CLIPreviewModal } from '~/ui/components/modals/cli-preview-modal';
import { UploadDataModal, type UploadDataType } from '~/ui/components/modals/upload-runner-data-modal';
import { Pane, PaneBody, PaneHeader } from '~/ui/components/panes/pane';
import { RunnerResultHistoryPane } from '~/ui/components/panes/runner-result-history-pane';
import { RunnerTestResultPane } from '~/ui/components/panes/runner-test-result-pane';
import { ResponseTimer } from '~/ui/components/response-timer';
import { getTimeAndUnit } from '~/ui/components/tags/time-tag';
import { Tooltip } from '~/ui/components/tooltip';
import { ResponseTimelineViewer } from '~/ui/components/viewers/response-timeline-viewer';
import { useRunnerContext } from '~/ui/context/app/runner-context';
import { useRunnerRequestList } from '~/ui/hooks/use-runner-request-list';
import { moveAfter, moveBefore } from '~/utils';
import { invariant } from '~/utils/invariant';
import { ResponseComparator } from '~/utils/response-comparison';

import { type RequestContext } from '../../../insomnia-scripting-environment/src/objects';
import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner';

const inputStyle =
  'placeholder:italic py-0.5 mr-1.5 px-1 w-24 rounded-sm border-2 border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors';
const iterationInputStyle =
  'placeholder:italic py-0.5 mr-1.5 px-1 w-16 rounded-sm border-2 border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors';

// TODO: improve the performance for a lot of logs
async function aggregateAllTimelines(errorMsg: string | null, testResult: RunnerTestResult) {
  let timelines = new Array<ResponseTimelineEntry>();
  const responsesInfo = testResult.responsesInfo;

  for (const respInfo of responsesInfo) {
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
  ancestors: { id: string; name: string }[];
  method: string;
  url: string;
  parentId: string;
}

const defaultAdvancedConfig = {
  bail: true,
  keepLog: true,
};

export const Runner: FC<{}> = () => {
  const [searchParams] = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<null | string>(null);

  const organizationData = useOrganizationLoaderData();
  const targetFolderId = searchParams.get('folder') || '';

  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    direction: 'vertical' | 'horizontal';
  };
  const [isRunning, setIsRunning] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);

  // For backward compatibility，the runnerId we use for testResult in database is no prefix with 'runner_'
  const runnerId = targetFolderId ? targetFolderId : workspaceId;

  const { settings } = useRootLoaderData()!;
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCLIModal, setShowCLIModal] = useState(false);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(
    settings.forceVerticalLayout ? 'vertical' : 'horizontal',
  );

  const { runnerStateMap, updateRunnerState } = useRunnerContext();
  const {
    iterationCount = 1,
    delay = 0,
    selectedKeys = new Set<Key>(),
    advancedConfig = defaultAdvancedConfig,
    uploadData = [],
    file,
    filePath,
    compareEnvironments = false,
    sourceEnvironmentId = '',
    targetEnvironmentId = '',
    persistResponses = false,
  } = runnerStateMap?.[organizationId]?.[runnerId] || {};
  invariant(iterationCount, 'iterationCount should not be null');

  const { reqList, requestRows, entityMap } = useRunnerRequestList(organizationId, targetFolderId, runnerId);

  useEffect(() => {
    const loadEnvironments = async () => {
      try {
        const baseEnvironment = await models.environment.getByParentId(workspaceId);
        const subEnvironments = baseEnvironment 
          ? await models.environment.findByParentId(baseEnvironment._id)
          : [];
        
        const allEnvironments = baseEnvironment ? [baseEnvironment, ...subEnvironments] : [];
        setEnvironments(allEnvironments);
      } catch (error) {
        console.error('Failed to load environments:', error);
      }
    };

    loadEnvironments();
  }, [workspaceId]);

  useEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => {};
    }
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
        <div className="rounded bg-slate-800 px-2 py-0.5">
          <mark
            className="text-extrabold rounded bg-green-400 px-2 text-lg dark:bg-green-400"
            style={{ color: 'black' }}
          >{` ${items.length}`}</mark>{' '}
          item(s)
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
  
  const runEnvironmentComparison = async (requests: typeof reqList) => {
    if (requests.length === 0) {
      showModal(AlertModal, {
        title: 'No Requests Selected',
        message: 'Please select at least one request to compare.',
      });
      setIsRunning(false);
      return;
    }

    const comparator = new ResponseComparator({
      ignoreFields: [],
      tolerancePercent: 0,
      ignoreHeaders: ['date', 'server', 'x-request-id'],
      compareResponseTime: true,
      responseSizeTolerance: 0,
      caseSensitive: true,
    });

    const results: ComparisonResult[] = [];
    setComparisonResults([]);

    for (const request of requests) {
      try {
        // Get the current workspace meta to store the active environment temporarily
        const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
        const originalEnvId = workspaceMeta?.activeEnvironmentId;
        
        console.log(`Executing request ${request.name} with source environment ${sourceEnvironmentId}`);
        
        // Execute request with source environment
        await models.workspaceMeta.updateByParentId(workspaceId, {
          activeEnvironmentId: sourceEnvironmentId,
        });

        // Clear any existing responses to ensure we get fresh data
        const existingResponses = await models.response.findByParentId(request.id);
        console.log(`Found ${existingResponses.length} existing responses for request`);

        const sourceResult = await sendActionImplementation({
          requestId: request.id,
          iteration: 1,
          iterationCount: 1,
          userUploadEnvironment: undefined,
          shouldPromptForPathAfterResponse: false,
          ignoreUndefinedEnvVariable: true,
          testResultCollector: {
            requestId: request.id,
            requestName: request.name,
            requestUrl: request.url,
            statusCode: 0,
            duration: 0,
            size: 0,
            results: [],
            responseId: '',
          },
          runtime: { appendTimeline: async () => {} },
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
        });

        console.log('Source result:', sourceResult);

        // Get the source response that was created
        const sourceResponse = await models.response.getLatestForRequest(request.id, sourceEnvironmentId);
        console.log('Source response:', sourceResponse);

        console.log(`Executing request ${request.name} with target environment ${targetEnvironmentId}`);
        
        // Execute request with target environment  
        await models.workspaceMeta.updateByParentId(workspaceId, {
          activeEnvironmentId: targetEnvironmentId,
        });

        const targetResult = await sendActionImplementation({
          requestId: request.id,
          iteration: 1,
          iterationCount: 1,
          userUploadEnvironment: undefined,
          shouldPromptForPathAfterResponse: false,
          ignoreUndefinedEnvVariable: true,
          testResultCollector: {
            requestId: request.id,
            requestName: request.name,
            requestUrl: request.url,
            statusCode: 0,
            duration: 0,
            size: 0,
            results: [],
            responseId: '',
          },
          runtime: { appendTimeline: async () => {} },
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
        });

        console.log('Target result:', targetResult);

        // Get the target response that was created
        const targetResponse = await models.response.getLatestForRequest(request.id, targetEnvironmentId);
        console.log('Target response:', targetResponse);
        
        // Restore original environment
        if (originalEnvId) {
          await models.workspaceMeta.updateByParentId(workspaceId, {
            activeEnvironmentId: originalEnvId,
          });
        }

        if (sourceResponse && targetResponse) {
          console.log('Both responses found, creating comparison...');
          
          // Get response bodies
          const sourceBodyBuffer = await models.response.getBodyBuffer(sourceResponse);
          const targetBodyBuffer = await models.response.getBodyBuffer(targetResponse);
          const sourceBody = sourceBodyBuffer ? sourceBodyBuffer.toString('utf8') : '';
          const targetBody = targetBodyBuffer ? targetBodyBuffer.toString('utf8') : '';
          
          console.log('Source body preview:', sourceBody?.slice(0, 200));
          console.log('Target body preview:', targetBody?.slice(0, 200));
          
          const comparisonData = await comparator.compare(
            sourceResponse,
            targetResponse,
            request.name
          );

          console.log('Comparison data:', comparisonData);

          const result = await models.comparisonResult.create({
            ...comparisonData,
            parentId: workspaceId,
            environmentComparisonId: `${sourceEnvironmentId}_vs_${targetEnvironmentId}`,
            sourceEnvironmentId: sourceEnvironmentId,
            targetEnvironmentId: targetEnvironmentId,
          });

          console.log('Created comparison result:', result);
          results.push(result);
        } else {
          console.warn('Missing responses:', { sourceResponse: !!sourceResponse, targetResponse: !!targetResponse });
          showModal(AlertModal, {
            title: `Comparison Incomplete - ${request.name}`,
            message: `Failed to retrieve ${!sourceResponse ? 'source' : 'target'} response for ${request.name}. The request may have failed or returned no data.`,
          });
        }
      } catch (error) {
        console.error(`Failed to compare request ${request.name}:`, error);
        showModal(AlertModal, {
          title: `Request Failed - ${request.name}`,
          message: error instanceof Error ? error.message : `Failed to execute ${request.name}. Check the request configuration and try again.`,
        });
      }
    }

    console.log('Final results:', results);
    console.log('Setting comparison results with', results.length, 'items');

    if (results.length === 0) {
      showModal(AlertModal, {
        title: 'No Comparisons Generated',
        message: 'No successful comparisons were created. Check that your requests are configured correctly and try again.',
      });
      setIsRunning(false);
      return;
    }

    setComparisonResults(results);

    // Switch to comparison results tab
    setSelectedTab('comparison-results');
    setIsRunning(false);
  };
  
  const onRun = async () => {
    if (isRunning) {
      return;
    }
    setIsRunning(true);

    window.main.trackSegmentEvent({
      event: SegmentEvent.collectionRunExecute,
      properties: { plan: organizationData?.currentPlan?.type || 'scratchpad', iterations: iterationCount },
    });

    const requests = selectedKeys === 'all' ? reqList : reqList.filter(item => (selectedKeys as Set<Key>).has(item.id));

    // Handle environment comparison mode
    if (compareEnvironments) {
      // Validation
      if (!sourceEnvironmentId || !targetEnvironmentId) {
        showModal(AlertModal, {
          title: 'Environments Not Selected',
          message: 'Please select both a source and target environment for comparison.',
        });
        setIsRunning(false);
        return;
      }

      if (sourceEnvironmentId === targetEnvironmentId) {
        showModal(AlertModal, {
          title: 'Same Environment Selected',
          message: 'Source and target environments must be different. Please select two different environments to compare.',
        });
        setIsRunning(false);
        return;
      }

      try {
        await runEnvironmentComparison(requests);
        return;
      } catch (error) {
        console.error('Environment comparison failed:', error);
        showModal(AlertModal, {
          title: 'Comparison Failed',
          message: error instanceof Error ? error.message : 'An unexpected error occurred during comparison. Please check your network connection and try again.',
        });
        setIsRunning(false);
        return;
      }
    }

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
    submit(JSON.stringify(actionInput), {
      method: 'POST',
      encType: 'application/json',
      action: href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/runner`, {
        organizationId,
        projectId,
        workspaceId,
      }),
      navigate: false,
    });
  };

  const navigate = useNavigate();
  const goToRequest = (requestId: string) => {
    navigate(
      `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}`,
    );
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
      const results = (await models.runnerTestResult.findByParentId(runnerId)) || [];
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
  const gotoExecutionResult = useCallback(
    async (executionId: string) => {
      const result = await models.runnerTestResult.getById(executionId);
      if (result) {
        setExecutionResult(result);
      }
    },
    [setExecutionResult],
  );

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
    showModal(AlertModal, {
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
      const results = (await models.runnerTestResult.findByParentId(runnerId)) || [];
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

  reactUse.useInterval(
    () => {
      refreshPanes();
    },
    isRunning ? 1000 : null,
  );

  useEffect(() => {
    refreshPanes();
  }, [refreshPanes]);

  const { passedTestCount, totalTestCount, testResultCountTagColor } = useMemo(() => {
    let passedTestCount = 0;
    let totalTestCount = 0;

    if (!isRunning) {
      if (executionResult?.iterationResults) {
        for (const iteration of executionResult.iterationResults) {
          for (const requests of iteration) {
            for (const testCase of requests.results) {
              if (testCase.status === 'passed') {
                passedTestCount++;
              }
              totalTestCount++;
            }
          }
        }
      }
    }

    const testResultCountTagColor =
      totalTestCount > 0 ? (passedTestCount === totalTestCount ? 'bg-lime-600' : 'bg-red-600') : 'bg-[var(--hl-sm)]';

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
          .filter(item => item.ancestors.map(a => a.id).includes(targetFolderId))
          .map(item => item.id)
          .filter(id => selectedKeys === 'all' || selectedKeys.has(id))
      : reqList.map(item => item.id).filter(id => selectedKeys === 'all' || selectedKeys.has(id));

  return (
    <>
      <Panel id="pane-one" className="pane-one theme--pane" minSize={35} maxSize={90}>
        <ErrorBoundary showAlert>
          <Pane type="request">
            <PaneHeader>
              <Heading className="flex h-[--line-height-sm] w-full items-center pl-[--padding-md]">
                <div className="h-full w-full overflow-hidden text-left">
                  <div className="h-full min-w-[500px]">
                    <span className="mr-6 text-sm">
                      <input
                        value={iterationCount}
                        name="Iterations"
                        disabled={isRunning}
                        onChange={e => {
                          try {
                            if (parseInt(e.target.value, 10) > 0) {
                              updateRunnerState(organizationId, runnerId, {
                                iterationCount: parseInt(e.target.value, 10),
                              });
                            }
                          } catch {}
                        }}
                        type="number"
                        className={iterationInputStyle}
                      />
                      <span className="border">Iterations</span>
                    </span>
                    <span className="mr-6 text-sm">
                      <input
                        value={delay}
                        disabled={isRunning}
                        name="Delay"
                        onChange={e => {
                          try {
                            const delay = parseInt(e.target.value, 10);
                            if (delay >= 0) {
                              updateRunnerState(organizationId, runnerId, { delay }); // also update the temp settings
                            }
                          } catch {}
                        }}
                        type="number"
                        className={inputStyle}
                      />
                      <span className="mr-1 border">Delay (ms)</span>
                    </span>
                    <Button
                      onPress={() => setShowUploadModal(true)}
                      className="mr-6 h-full rounded-sm border-[--hl-sm] px-1 py-0.5 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] aria-pressed:bg-[--hl-sm]"
                      isDisabled={isRunning}
                    >
                      <Icon icon={file ? 'eye' : 'upload'} /> {file ? 'View Data' : 'Upload Data'}
                    </Button>
                  </div>
                </div>
                <div className="flex self-stretch p-1">
                  <Button
                    isDisabled={isDisabled}
                    className="ml-1 rounded-l-sm bg-[--color-surprise] px-5 text-[--color-font-surprise] hover:bg-opacity-90 focus:bg-opacity-90"
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
                        className="rounded-r-sm bg-[--color-surprise] px-1 text-[--color-font-surprise]"
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
                    <DropdownItem aria-label="Run via CLI">
                      <ItemContent icon="code" label="Run via CLI" onClick={() => setShowCLIModal(true)} />
                    </DropdownItem>
                  </Dropdown>
                </div>
              </Heading>
            </PaneHeader>
            <Tabs aria-label="Request group tabs" className="flex h-full w-full flex-1 flex-col">
              <TabList
                className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
                aria-label="Request pane tabs"
              >
                <Tab
                  className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                  id="request-order"
                >
                  <i className="fa fa-sort fa-1x mr-2 h-4" />
                  Request Order
                </Tab>
                <Tab
                  className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                  id="advanced"
                >
                  <i className="fa fa-gear fa-1x mr-2 h-4" />
                  Advanced
                </Tab>
              </TabList>
              <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="request-order">
                <Toolbar className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center border-b border-solid border-[--hl-md] px-2">
                  <span className="mr-2">
                    {selectedKeys === 'all' || Array.from(selectedKeys).length === Array.from(reqList).length ? (
                      <span onClick={onToggleSelection}>
                        <i style={{ color: 'rgb(74 222 128)' }} className="fa fa-square-check fa-1x mr-2 h-4" />{' '}
                        <span className="cursor-pointer">Unselect All</span>
                      </span>
                    ) : Array.from(selectedKeys).length === 0 ? (
                      <span onClick={onToggleSelection}>
                        <i className="fa fa-square fa-1x mr-2 h-4" /> <span className="cursor-pointer">Select All</span>
                      </span>
                    ) : (
                      <span onClick={onToggleSelection}>
                        <i style={{ color: 'rgb(74 222 128)' }} className="fa fa-square-minus fa-1x mr-2 h-4" />{' '}
                        <span className="cursor-pointer">Select All</span>
                      </span>
                    )}
                  </span>
                </Toolbar>
                <PaneBody placeholder className="p-0">
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
                    className="h-full w-full overflow-auto text-base leading-8"
                    disabledKeys={disabledKeys}
                  >
                    {item => {
                      const parentFolders = item.ancestors.map(({ id, name }) => {
                        return (
                          <TooltipTrigger key={`parent-folder-${id}=${name}`}>
                            <Tooltip message={name}>
                              <i className="fa fa-folder fa-1x mr-0.3 h-4 text-[--color-font]" />
                              <i className="fa fa-caret-right fa-1x mr-0.3 text-[--color-font]-50 h-4 opacity-50" />
                            </Tooltip>
                          </TooltipTrigger>
                        );
                      });
                      const parentFolderContainer =
                        parentFolders.length > 0 ? <span className="ml-2">{parentFolders}</span> : null;

                      return (
                        <GridListItem
                          textValue={item.name}
                          className={`runner-request-list-${item.name} border border-solid border-transparent text-[--color-font]`}
                          style={{ outline: 'none' }}
                        >
                          <Button slot="drag" className="hover:cursor-grab">
                            <Icon icon="grip-vertical" className="mr-2 w-2 text-[--hl]" />
                          </Button>
                          <Checkbox slot="selection">
                            {({ isSelected }) => (
                              <>
                                {isSelected ? (
                                  <i
                                    className="fa fa-square-check fa-1x mr-2 h-4"
                                    style={{ color: 'rgb(74 222 128)' }}
                                  />
                                ) : (
                                  <i className="fa fa-square fa-1x mr-2 h-4" />
                                )}
                              </>
                            )}
                          </Checkbox>
                          {parentFolderContainer}
                          <span className={`ml-2 text-xs uppercase http-method-${item.method}`}>{item.method}</span>
                          <span
                            className="ml-2 cursor-pointer text-[--hl] hover:underline"
                            onClick={() => goToRequest(item.id)}
                          >
                            {item.name}
                          </span>
                        </GridListItem>
                      );
                    }}
                  </GridList>
                </PaneBody>
              </TabPanel>
              <TabPanel className="align-center flex w-full flex-1 overflow-y-auto" id="advanced">
                <div className="w-full p-4 space-y-4">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        name="persist-response" 
                        onChange={() => {
                          updateRunnerState(organizationId, runnerId, {
                            persistResponses: !persistResponses,
                          });
                        }}
                        type="checkbox" 
                        disabled={isRunning}
                        checked={persistResponses}
                      />
                      Persist responses for a session
                      <HelpTooltip className="space-left">
                        Enabling this will impact performance while responses are saved for other purposes.
                      </HelpTooltip>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        name="enable-log"
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
                      <HelpTooltip className="space-left">
                        Disabling this will improve the performance while logs are not saved.
                      </HelpTooltip>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        name="bail"
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
                  
                  {/* Environment Comparison Section */}
                  <div className="border-t border-[--hl-md] pt-4">
                    <div>
                      <label className="flex items-center gap-2 mb-4">
                        <input
                          name="compare-environments"
                          onChange={() => {
                            updateRunnerState(organizationId, runnerId, {
                              compareEnvironments: !compareEnvironments,
                            });
                          }}
                          type="checkbox"
                          disabled={isRunning}
                          checked={compareEnvironments}
                        />
                        Enable environment comparison
                        <HelpTooltip className="space-left">
                          Run each request in two different environments and compare the responses.
                        </HelpTooltip>
                      </label>
                    </div>
                    
                    {compareEnvironments && (
                      <div className="ml-6 space-y-3">
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <Label className="text-sm font-medium text-[--color-font]">Source Environment</Label>
                            <HelpTooltip>
                              The baseline environment to compare against. Responses from this environment will be marked with "-" (red).
                            </HelpTooltip>
                          </div>
                          <Select
                            selectedKey={sourceEnvironmentId}
                            onSelectionChange={(key) => updateRunnerState(organizationId, runnerId, {
                              sourceEnvironmentId: key as string,
                            })}
                            isDisabled={isRunning}
                          >
                            <Button className="flex items-center justify-between w-full px-3 py-2 border rounded-md bg-[--color-bg] text-[--color-font] border-[--hl-md] hover:border-[--hl] focus:ring-2 focus:ring-[--hl] focus:outline-none">
                              <SelectValue className="flex-1 text-left">
                                {({ selectedText }) => (
                                  <span className={!selectedText ? 'text-[--hl]' : ''}>
                                    {selectedText || 'Select source environment'}
                                  </span>
                                )}
                              </SelectValue>
                              <Icon icon="chevron-down" className="ml-2" />
                            </Button>
                            <Popover className="min-w-[--trigger-width] bg-[--color-bg] border border-[--hl-md] rounded-md shadow-lg z-50 mt-1">
                              <ListBox className="max-h-60 overflow-auto p-1">
                                {environments.map(env => (
                                  <ListBoxItem
                                    key={env._id}
                                    id={env._id}
                                    textValue={env.name}
                                    className="px-3 py-2 rounded hover:bg-[--hl-xs] cursor-pointer text-[--color-font] focus:bg-[--hl-xs] focus:outline-none aria-selected:bg-[--hl-sm]"
                                  >
                                    {env.name}
                                  </ListBoxItem>
                                ))}
                              </ListBox>
                            </Popover>
                          </Select>
                        </div>

                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <Label className="text-sm font-medium text-[--color-font]">Target Environment</Label>
                            <HelpTooltip>
                              The environment to compare. Responses from this environment will be marked with "+" (green).
                            </HelpTooltip>
                          </div>
                          <Select
                            selectedKey={targetEnvironmentId}
                            onSelectionChange={(key) => updateRunnerState(organizationId, runnerId, {
                              targetEnvironmentId: key as string,
                            })}
                            isDisabled={isRunning}
                          >
                            <Button className="flex items-center justify-between w-full px-3 py-2 border rounded-md bg-[--color-bg] text-[--color-font] border-[--hl-md] hover:border-[--hl] focus:ring-2 focus:ring-[--hl] focus:outline-none">
                              <SelectValue className="flex-1 text-left">
                                {({ selectedText }) => (
                                  <span className={!selectedText ? 'text-[--hl]' : ''}>
                                    {selectedText || 'Select target environment'}
                                  </span>
                                )}
                              </SelectValue>
                              <Icon icon="chevron-down" className="ml-2" />
                            </Button>
                            <Popover className="min-w-[--trigger-width] bg-[--color-bg] border border-[--hl-md] rounded-md shadow-lg z-50 mt-1">
                              <ListBox className="max-h-60 overflow-auto p-1">
                                {environments.map(env => (
                                  <ListBoxItem
                                    key={env._id}
                                    id={env._id}
                                    textValue={env.name}
                                    className="px-3 py-2 rounded hover:bg-[--hl-xs] cursor-pointer text-[--color-font] focus:bg-[--hl-xs] focus:outline-none aria-selected:bg-[--hl-sm]"
                                  >
                                    {env.name}
                                  </ListBoxItem>
                                ))}
                              </ListBox>
                            </Popover>
                          </Select>
                        </div>
                        
                        {sourceEnvironmentId === targetEnvironmentId && sourceEnvironmentId && (
                          <div className="p-2 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
                            Source and target environments must be different for comparison.
                          </div>
                        )}
                      </div>
                    )}
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
                filePath={filePath || ''}
                bail={advancedConfig?.bail}
              />
            )}
            {showUploadModal && (
              <UploadDataModal
                onUploadFile={(file, uploadData) => {
                  const filePath = file ? window.webUtils.getPathForFile(file) : '';
                  updateRunnerState(organizationId, runnerId, {
                    uploadData,
                    file,
                    filePath,
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
      <PanelResizeHandle
        className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'h-[1px] w-full bg-[--hl-md]'}
      />
      <Panel id="pane-two" className="pane-two theme--pane">
        <PaneHeader className="row-spaced">
          <Heading className="flex h-[--line-height-sm] w-full items-center border-b border-solid border-b-[--hl-md] pl-3">
            {executionResult?.duration ? (
              <div className="bg-info tag">
                <strong>{`${totalTime.duration} ${totalTime.unit}`}</strong>
              </div>
            ) : (
              <span className="font-bold">Collection Runner</span>
            )}
          </Heading>
        </PaneHeader>
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={setSelectedTab}
          aria-label="Request group tabs"
          className="flex h-full w-full flex-1 flex-col"
        >
          <TabList
            className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
            aria-label="Request pane tabs"
          >
            <Tab
              className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
              id="test-results"
            >
              <div>
                <span>Tests</span>
                <span
                  className={`test-result-count ml-1 rounded-sm px-1 ${testResultCountTagColor}`}
                  style={{ color: 'white' }}
                >
                  {`${passedTestCount} / ${totalTestCount}`}
                </span>
              </div>
            </Tab>
            <Tab
              className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
              id="comparison-results"
            >
              <div>
                <span>Response Comparison</span>
                <span
                  className={`ml-1 rounded-sm px-1 ${comparisonResults.length > 0 ? 'bg-blue-600' : 'bg-[var(--hl-sm)]'}`}
                  style={{ color: 'white' }}
                >
                  {comparisonResults.length}
                </span>
              </div>
            </Tab>
            <Tab
              className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
              id="history"
            >
              History
            </Tab>
            <Tab
              className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
              id="console"
            >
              Console
            </Tab>
          </TabList>
          <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="console">
            <ResponseTimelineViewer key={runnerId} timeline={timelines} />
          </TabPanel>
          <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="comparison-results">
            <ComparisonResultsPane results={comparisonResults} />
          </TabPanel>
          <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="history">
            <RunnerResultHistoryPane
              history={testHistory.filter(item => !deletedItems.includes(item._id))}
              gotoExecutionResult={gotoExecutionResult}
              gotoTestResultsTab={gotoTestResultsTab}
              deleteHistoryItem={deleteHistoryItem}
            />
          </TabPanel>
          <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="test-results">
            {isRunning && (
              <div className="text-md flex h-full w-full items-center">
                <ResponseTimer
                  handleCancel={() => cancelExecution(runnerId)}
                  activeRequestId={runnerId}
                  steps={timingSteps}
                />
              </div>
            )}
            {!isRunning && (
              <ErrorBoundary showAlert>
                <RunnerTestResultPane result={executionResult} />
              </ErrorBoundary>
            )}
          </TabPanel>
        </Tabs>
      </Panel>
    </>
  );
};


// Comparison Results Pane Component
interface ComparisonResultsPaneProps {
  results: ComparisonResult[];
}

type SortOption = 'name' | 'match-desc' | 'match-asc' | 'diff-desc' | 'diff-asc';

const ComparisonResultsPane: FC<ComparisonResultsPaneProps> = ({ results }) => {
  const [selectedResult, setSelectedResult] = useState<ComparisonResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [compactView, setCompactView] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<'source' | 'target' | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    if (results.length === 0) return null;

    const avgMatch = results.reduce((sum, r) => sum + r.summary.matchPercentage, 0) / results.length;
    const totalDiffs = results.reduce((sum, r) => sum + r.summary.totalDifferences, 0);
    const passCount = results.filter(r => r.summary.matchPercentage >= 95).length;

    return {
      total: results.length,
      avgMatch,
      totalDiffs,
      passCount,
      warnCount: results.filter(r => r.summary.matchPercentage >= 80 && r.summary.matchPercentage < 95).length,
      failCount: results.filter(r => r.summary.matchPercentage < 80).length,
    };
  }, [results]);

  // Filter and sort results
  const filteredAndSortedResults = useMemo(() => {
    let filtered = results.filter(result =>
      result.requestName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort results
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.requestName.localeCompare(b.requestName));
        break;
      case 'match-desc':
        filtered.sort((a, b) => b.summary.matchPercentage - a.summary.matchPercentage);
        break;
      case 'match-asc':
        filtered.sort((a, b) => a.summary.matchPercentage - b.summary.matchPercentage);
        break;
      case 'diff-desc':
        filtered.sort((a, b) => b.summary.totalDifferences - a.summary.totalDifferences);
        break;
      case 'diff-asc':
        filtered.sort((a, b) => a.summary.totalDifferences - b.summary.totalDifferences);
        break;
    }

    return filtered;
  }, [results, searchQuery, sortBy]);

  useEffect(() => {
    console.log('ComparisonResultsPane received results:', results);
    if (filteredAndSortedResults.length > 0 && !selectedResult) {
      console.log('Setting first result as selected:', filteredAndSortedResults[0]);
      setSelectedResult(filteredAndSortedResults[0]);
    }
  }, [filteredAndSortedResults, selectedResult]);

  // Helper function to get status icon
  const getStatusIcon = (matchPercentage: number) => {
    if (matchPercentage >= 95) return { icon: 'check-circle' as const, color: 'text-green-600' };
    if (matchPercentage >= 80) return { icon: 'exclamation-triangle' as const, color: 'text-yellow-600' };
    return { icon: 'times-circle' as const, color: 'text-red-600' };
  };

  // Copy URL to clipboard
  const copyUrlToClipboard = async (url: string, type: 'source' | 'target') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(type);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy URL to clipboard:', error);
    }
  };

  // Export all results
  const exportAllResults = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `comparison-all-results-${timestamp}.txt`;

      let exportContent = `📊 Environment Comparison Results\n`;
      exportContent += `${'='.repeat(80)}\n\n`;
      exportContent += `📅 Generated: ${new Date().toISOString()}\n`;
      exportContent += `📈 Total Requests: ${stats?.total || 0}\n`;
      exportContent += `✅ Passed (≥95%): ${stats?.passCount || 0}\n`;
      exportContent += `⚠️  Warning (80-95%): ${stats?.warnCount || 0}\n`;
      exportContent += `❌ Failed (<80%): ${stats?.failCount || 0}\n`;
      exportContent += `📊 Average Match: ${stats?.avgMatch.toFixed(1)}%\n`;
      exportContent += `${'='.repeat(80)}\n\n`;

      filteredAndSortedResults.forEach((result, index) => {
        exportContent += `\n${index + 1}. ${result.requestName}\n`;
        exportContent += `${'─'.repeat(40)}\n`;
        exportContent += `Match: ${result.summary.matchPercentage.toFixed(1)}%\n`;
        exportContent += `Differences: ${result.summary.totalDifferences}\n`;
        exportContent += `Status Codes: ${result.sourceStatusCode} → ${result.targetStatusCode}\n`;
        exportContent += `Source: ${result.sourceUrl}\n`;
        exportContent += `Target: ${result.targetUrl}\n`;
      });

      const blob = new Blob([exportContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export all results:', error);
    }
  };

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[--hl]">
        <div className="text-center">
          <Icon icon="code-compare" className="text-4xl mb-4" />
          <p className="text-lg">No comparison results yet</p>
          <p className="text-sm">Run an environment comparison to see results here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats Dashboard */}
      {stats && (
        <div className="px-4 py-3 bg-[--hl-xs] border-b border-[--hl-md]">
          <div className="flex items-center justify-between mb-2">
            <Heading className="text-sm font-semibold text-[--color-font]">Comparison Summary</Heading>
            <Button
              onPress={exportAllResults}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[--color-bg] hover:bg-[--hl-xs] border border-[--hl-md] text-[--color-font]"
            >
              <Icon icon="download" />
              Export All
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            <div className="p-2 bg-[--color-bg] rounded">
              <div className="font-bold text-[--color-font]">{stats.total}</div>
              <div className="text-[--hl]">Total</div>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <div className="font-bold text-green-700">✅ {stats.passCount}</div>
              <div className="text-green-600">Pass</div>
            </div>
            <div className="p-2 bg-yellow-50 rounded">
              <div className="font-bold text-yellow-700">⚠️ {stats.warnCount}</div>
              <div className="text-yellow-600">Warn</div>
            </div>
            <div className="p-2 bg-red-50 rounded">
              <div className="font-bold text-red-700">❌ {stats.failCount}</div>
              <div className="text-red-600">Fail</div>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <div className="font-bold text-blue-700">{stats.avgMatch.toFixed(0)}%</div>
              <div className="text-blue-600">Avg Match</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-full overflow-hidden">
        {/* Results List */}
        <div className="w-1/3 border-r border-[--hl-md] flex flex-col">
          {/* Search and Controls */}
          <div className="p-2 border-b border-[--hl-md] space-y-2">
            <div className="relative">
              <Icon icon="search" className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[--hl]" />
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded bg-[--color-bg] text-[--color-font] border-[--hl-md] focus:ring-1 focus:ring-[--hl] focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Select
                selectedKey={sortBy}
                onSelectionChange={(key) => setSortBy(key as SortOption)}
                className="flex-1"
              >
                <Button className="flex items-center justify-between w-full px-2 py-1 text-xs border rounded bg-[--color-bg] text-[--color-font] border-[--hl-md] hover:border-[--hl]">
                  <span>
                    {sortBy === 'name' ? 'Sort: Name' :
                     sortBy === 'match-desc' ? 'Sort: Match ↓' :
                     sortBy === 'match-asc' ? 'Sort: Match ↑' :
                     sortBy === 'diff-desc' ? 'Sort: Diffs ↓' :
                     'Sort: Diffs ↑'}
                  </span>
                  <Icon icon="sort" className="ml-1" />
                </Button>
                <Popover className="min-w-[--trigger-width] bg-[--color-bg] border border-[--hl-md] rounded shadow-lg z-50 mt-1">
                  <ListBox className="p-1">
                    <ListBoxItem id="name" textValue="Name" className="px-2 py-1 text-xs rounded hover:bg-[--hl-xs] cursor-pointer text-[--color-font] focus:outline-none aria-selected:bg-[--hl-sm]">Name</ListBoxItem>
                    <ListBoxItem id="match-desc" textValue="Match (High to Low)" className="px-2 py-1 text-xs rounded hover:bg-[--hl-xs] cursor-pointer text-[--color-font] focus:outline-none aria-selected:bg-[--hl-sm]">Match (High to Low)</ListBoxItem>
                    <ListBoxItem id="match-asc" textValue="Match (Low to High)" className="px-2 py-1 text-xs rounded hover:bg-[--hl-xs] cursor-pointer text-[--color-font] focus:outline-none aria-selected:bg-[--hl-sm]">Match (Low to High)</ListBoxItem>
                    <ListBoxItem id="diff-desc" textValue="Differences (Most)" className="px-2 py-1 text-xs rounded hover:bg-[--hl-xs] cursor-pointer text-[--color-font] focus:outline-none aria-selected:bg-[--hl-sm]">Differences (Most)</ListBoxItem>
                    <ListBoxItem id="diff-asc" textValue="Differences (Least)" className="px-2 py-1 text-xs rounded hover:bg-[--hl-xs] cursor-pointer text-[--color-font] focus:outline-none aria-selected:bg-[--hl-sm]">Differences (Least)</ListBoxItem>
                  </ListBox>
                </Popover>
              </Select>
              <Button
                onPress={() => setCompactView(!compactView)}
                className="px-2 py-1 text-xs border rounded bg-[--color-bg] text-[--color-font] border-[--hl-md] hover:border-[--hl]"
              >
                <Icon icon={compactView ? 'list' : 'th-list'} />
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredAndSortedResults.length === 0 ? (
              <div className="text-center text-[--hl] text-sm py-4">
                No results match "{searchQuery}"
              </div>
            ) : (
              filteredAndSortedResults.map((result) => {
                const status = getStatusIcon(result.summary.matchPercentage);
                return (
                  <div
                    key={result._id}
                    onClick={() => setSelectedResult(result)}
                    className={`${compactView ? 'p-2 mb-1' : 'p-3 mb-2'} rounded cursor-pointer border ${
                      selectedResult?._id === result._id
                        ? 'bg-blue-50 border-blue-200 text-blue-900'
                        : 'bg-[--color-bg] border-[--hl-md] text-[--color-font] hover:bg-[--hl-xs]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Icon icon={status.icon} className={`${status.color} flex-shrink-0`} />
                        <div className={`${compactView ? 'text-xs' : 'text-sm'} font-medium truncate`}>
                          {result.requestName}
                        </div>
                      </div>
                    </div>
                    {!compactView && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs ${
                          result.summary.matchPercentage >= 95 ? 'bg-green-100 text-green-700' :
                          result.summary.matchPercentage >= 80 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {result.summary.matchPercentage.toFixed(0)}% match
                        </span>
                        {result.summary.totalDifferences > 0 && (
                          <span className="text-xs text-[--hl]">
                            {result.summary.totalDifferences} diff(s)
                          </span>
                        )}
                      </div>
                    )}
                    {compactView && (
                      <div className="text-xs text-[--hl] mt-0.5">
                        {result.summary.matchPercentage.toFixed(0)}% • {result.summary.totalDifferences} diffs
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedResult ? (
            <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-[--hl-md]">
              <Heading className="text-lg font-semibold mb-2 text-[--color-font]">
                {selectedResult.requestName}
              </Heading>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className={`p-3 rounded text-center ${
                  selectedResult.summary.matchPercentage >= 95 ? 'bg-green-100' :
                  selectedResult.summary.matchPercentage >= 80 ? 'bg-yellow-100' :
                  'bg-red-100'
                }`}>
                  <div className={`text-lg font-bold ${
                    selectedResult.summary.matchPercentage >= 95 ? 'text-green-700' :
                    selectedResult.summary.matchPercentage >= 80 ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {selectedResult.summary.matchPercentage.toFixed(1)}%
                  </div>
                  <div className={`text-xs ${
                    selectedResult.summary.matchPercentage >= 95 ? 'text-green-600' :
                    selectedResult.summary.matchPercentage >= 80 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>Match</div>
                </div>
                <div className="p-3 bg-red-100 rounded text-center">
                  <div className="text-lg font-bold text-red-700">
                    {selectedResult.summary.totalDifferences}
                  </div>
                  <div className="text-xs text-red-600">Differences</div>
                </div>
                <div className={`p-3 rounded text-center ${
                  selectedResult.summary.statusCodeMatch ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <div className={`text-lg font-bold ${
                    selectedResult.summary.statusCodeMatch ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {selectedResult.sourceStatusCode} / {selectedResult.targetStatusCode}
                  </div>
                  <div className={`text-xs ${
                    selectedResult.summary.statusCodeMatch ? 'text-green-600' : 'text-red-600'
                  }`}>Status</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="font-medium text-[--color-font]">Source Environment:</Label>
                  <div className="flex items-start gap-2 group">
                    <p className="text-[--hl] break-all flex-1">{selectedResult.sourceUrl}</p>
                    <button
                      onClick={() => copyUrlToClipboard(selectedResult.sourceUrl, 'source')}
                      className="opacity-0 group-hover:opacity-100 text-[--hl] hover:text-[--color-font] flex-shrink-0 mt-0.5"
                      title="Copy URL"
                    >
                      <Icon icon={copiedUrl === 'source' ? 'check' : 'copy'} className="text-xs" />
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="font-medium text-[--color-font]">Target Environment:</Label>
                  <div className="flex items-start gap-2 group">
                    <p className="text-[--hl] break-all flex-1">{selectedResult.targetUrl}</p>
                    <button
                      onClick={() => copyUrlToClipboard(selectedResult.targetUrl, 'target')}
                      className="opacity-0 group-hover:opacity-100 text-[--hl] hover:text-[--color-font] flex-shrink-0 mt-0.5"
                      title="Copy URL"
                    >
                      <Icon icon={copiedUrl === 'target' ? 'check' : 'copy'} className="text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Git-style Diff Viewer */}
            <div className="flex-1 overflow-auto">
              <ResponseDiffViewer
                sourceResponseId={selectedResult.sourceResponseId}
                targetResponseId={selectedResult.targetResponseId}
                requestName={selectedResult.requestName}
                sourceEnvironmentId={selectedResult.sourceEnvironmentId}
                targetEnvironmentId={selectedResult.targetEnvironmentId}
                headerDifferences={selectedResult.headerDifferences}
              />
            </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[--hl]">
              <p>Select a comparison result to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Git-style Diff Viewer Component
interface ResponseDiffViewerProps {
  sourceResponseId: string;
  targetResponseId: string;
  requestName: string;
  sourceEnvironmentId?: string;
  targetEnvironmentId?: string;
  headerDifferences?: Array<{
    name: string;
    sourceValue?: string;
    targetValue?: string;
    type: 'added' | 'removed' | 'modified';
  }>;
}

const ResponseDiffViewer: FC<ResponseDiffViewerProps> = ({
  sourceResponseId,
  targetResponseId,
  requestName,
  sourceEnvironmentId,
  targetEnvironmentId,
  headerDifferences = [],
}) => {
  const [sourceResponse, setSourceResponse] = useState<any>(null);
  const [targetResponse, setTargetResponse] = useState<any>(null);
  const [sourceEnvName, setSourceEnvName] = useState<string>('Source');
  const [targetEnvName, setTargetEnvName] = useState<string>('Target');
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [sideBySide, setSideBySide] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLineIndex, setCopiedLineIndex] = useState<number | null>(null);

  // Filter diff lines by search query
  const filteredDiffLines = useMemo(() => {
    if (!searchQuery) return diffLines;
    return diffLines.filter(line =>
      line.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      line.type === 'separator'
    );
  }, [diffLines, searchQuery]);

  // Copy line to clipboard
  const copyLineToClipboard = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedLineIndex(index);
      setTimeout(() => setCopiedLineIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  useEffect(() => {
    console.log('ResponseDiffViewer loading responses:', { sourceResponseId, targetResponseId });
    
    const loadResponses = async () => {
      setLoading(true);
      try {
        const [source, target] = await Promise.all([
          models.response.getById(sourceResponseId),
          models.response.getById(targetResponseId)
        ]);
        
        console.log('Loaded responses:', { source, target });
        
        setSourceResponse(source);
        setTargetResponse(target);

        // Load environment names if IDs are provided
        if (sourceEnvironmentId) {
          const sourceEnv = await models.environment.getById(sourceEnvironmentId);
          if (sourceEnv) {
            setSourceEnvName(sourceEnv.name || 'Source');
          }
        }
        
        if (targetEnvironmentId) {
          const targetEnv = await models.environment.getById(targetEnvironmentId);
          if (targetEnv) {
            setTargetEnvName(targetEnv.name || 'Target');
          }
        }

        if (source && target) {
          console.log('Generating diff between responses...');
          const diff = await generateUnifiedDiff(source, target);
          console.log('Generated diff lines:', diff.length);
          setDiffLines(diff);
        }
      } catch (error) {
        console.error('Failed to load responses for diff:', error);
      } finally {
        setLoading(false);
      }
    };

    loadResponses();
  }, [sourceResponseId, targetResponseId, sourceEnvironmentId, targetEnvironmentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[--hl]">Loading response diff...</div>
      </div>
    );
  }

  if (!sourceResponse || !targetResponse) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[--hl]">Could not load responses</div>
      </div>
    );
  }

  const exportComparison = async () => {
    try {
      // Generate export content
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `comparison-${requestName.replace(/[^a-z0-9]/gi, '-')}-${timestamp}.txt`;

      let exportContent = `📊 Response Body Comparison\n`;
      exportContent += `${'='.repeat(80)}\n\n`;
      exportContent += `🎯 Request: ${requestName}\n`;
      exportContent += `🔴 Source Environment: ${sourceEnvName}\n`;
      exportContent += `🟢 Target Environment: ${targetEnvName}\n`;
      exportContent += `📅 Generated: ${new Date().toISOString()}\n`;
      exportContent += `${'='.repeat(80)}\n\n`;

      // Add diff content
      diffLines.forEach(line => {
        if (line.type === 'separator' && line.skippedLines && line.skippedLines >= 10) {
          exportContent += `\n${line.content}\n\n`;
        } else if (line.type === 'separator') {
          exportContent += '\n';
        } else {
          const prefix = line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  ';
          const lineNum = line.lineNumber ? `${String(line.lineNumber).padStart(5, ' ')} ` : '      ';
          exportContent += `${lineNum}${prefix}${line.content}\n`;
        }
      });

      // Create and download file
      const blob = new Blob([exportContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export comparison:', error);
      showModal(AlertModal, {
        title: 'Export Failed',
        message: 'Failed to export comparison results.',
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[--color-bg]">
      {/* Diff Header */}
      <div className="p-3 bg-[--hl-xs] border-b border-[--hl-md]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 font-mono text-sm">
            <div className="text-[--color-font] font-medium">
              Response Body Comparison - {requestName}
            </div>
            <div className="text-[--hl] mt-1">
              <span className="text-red-600">- {sourceEnvName}</span> | <span className="text-green-600">+ {targetEnvName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onPress={() => setSideBySide(!sideBySide)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[--color-bg] hover:bg-[--hl-xs] border border-[--hl-md] text-[--color-font]"
            >
              <Icon icon={sideBySide ? 'align-justify' : 'columns'} />
              <span>{sideBySide ? 'Unified' : 'Side-by-Side'}</span>
            </Button>
            <Button
              onPress={exportComparison}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[--color-bg] hover:bg-[--hl-xs] border border-[--hl-md] text-[--color-font]"
            >
              <Icon icon="download" />
              <span>Export</span>
            </Button>
          </div>
        </div>
        {/* Search bar */}
        <div className="relative">
          <Icon icon="search" className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[--hl] text-xs" />
          <input
            type="text"
            placeholder="Search in diff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 text-xs border rounded bg-[--color-bg] text-[--color-font] border-[--hl-md] focus:ring-1 focus:ring-[--hl] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[--hl] hover:text-[--color-font]"
            >
              <Icon icon="times" className="text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* Header Differences Section */}
      {headerDifferences.length > 0 && (
        <div className="border-b border-[--hl-md] bg-[--hl-xs]">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heading className="text-sm font-semibold text-[--color-font]">
                HTTP Header Differences
              </Heading>
              <span
                className="text-xs text-[--hl] cursor-help"
                title="Header differences are shown for informational purposes but are not included in the match percentage calculation"
              >
                ℹ️ (Not counted in match %)
              </span>
            </div>
            <div className="space-y-1">
              {headerDifferences.map((diff, index) => (
                <div key={index} className="text-xs font-mono bg-[--color-bg] rounded p-2 border border-[--hl-md]">
                  <span className="font-semibold text-[--color-font]">{diff.name}:</span>
                  {diff.type === 'modified' && (
                    <div className="ml-2">
                      <div className="text-red-700 dark:text-red-300">- {diff.sourceValue}</div>
                      <div className="text-green-700 dark:text-green-300">+ {diff.targetValue}</div>
                    </div>
                  )}
                  {diff.type === 'removed' && (
                    <div className="ml-2 text-red-700 dark:text-red-300">- {diff.sourceValue}</div>
                  )}
                  {diff.type === 'added' && (
                    <div className="ml-2 text-green-700 dark:text-green-300">+ {diff.targetValue}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Diff Content */}
      <div className="flex-1 overflow-auto">
        {sideBySide ? (
          // Side-by-side view
          <div className="grid grid-cols-2 gap-px bg-[--hl-md] font-mono text-sm">
            {/* Source column */}
            <div className="bg-[--color-bg]">
              <div className="sticky top-0 bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 border-b border-[--hl-md]">
                - {sourceEnvName}
              </div>
              <div className="pb-16">
                {filteredDiffLines.map((line, index) => {
                  if (line.type === 'separator') {
                    if (line.skippedLines && line.skippedLines >= 10) {
                      return (
                        <div key={`sep-src-${index}`} className="flex items-center justify-center py-2 bg-[--hl-xs] text-[--hl] text-xs">
                          <Icon icon="ellipsis-h" className="mr-2" />
                          {line.content}
                        </div>
                      );
                    }
                    return <div key={`space-src-${index}`} className="h-4" />;
                  }
                  if (line.type === 'removed' || line.type === 'context') {
                    return (
                      <div
                        key={`src-${index}`}
                        className={`group flex hover:bg-red-100 ${line.type === 'removed' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                      >
                        <div className="w-10 px-2 py-1 text-right text-[--hl] text-xs border-r border-[--hl-md]">
                          {line.lineNumber}
                        </div>
                        <div className={`flex-1 px-3 py-1 whitespace-pre-wrap text-xs ${
                          line.type === 'removed' ? 'text-red-800 dark:text-red-200' : 'text-[--color-font]'
                        }`}>
                          {line.content}
                        </div>
                        <button
                          onClick={() => copyLineToClipboard(line.content, index)}
                          className="opacity-0 group-hover:opacity-100 px-2 text-[--hl] hover:text-[--color-font]"
                          title="Copy line"
                        >
                          <Icon icon={copiedLineIndex === index ? 'check' : 'copy'} className="text-xs" />
                        </button>
                      </div>
                    );
                  }
                  return <div key={`src-empty-${index}`} className="h-6 bg-gray-50" />;
                })}
              </div>
            </div>

            {/* Target column */}
            <div className="bg-[--color-bg]">
              <div className="sticky top-0 bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 border-b border-[--hl-md]">
                + {targetEnvName}
              </div>
              <div className="pb-16">
                {filteredDiffLines.map((line, index) => {
                  if (line.type === 'separator') {
                    if (line.skippedLines && line.skippedLines >= 10) {
                      return (
                        <div key={`sep-tgt-${index}`} className="flex items-center justify-center py-2 bg-[--hl-xs] text-[--hl] text-xs">
                          <Icon icon="ellipsis-h" className="mr-2" />
                          {line.content}
                        </div>
                      );
                    }
                    return <div key={`space-tgt-${index}`} className="h-4" />;
                  }
                  if (line.type === 'added' || line.type === 'context') {
                    return (
                      <div
                        key={`tgt-${index}`}
                        className={`group flex hover:bg-green-100 ${line.type === 'added' ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                      >
                        <div className="w-10 px-2 py-1 text-right text-[--hl] text-xs border-r border-[--hl-md]">
                          {line.lineNumber}
                        </div>
                        <div className={`flex-1 px-3 py-1 whitespace-pre-wrap text-xs ${
                          line.type === 'added' ? 'text-green-800 dark:text-green-200' : 'text-[--color-font]'
                        }`}>
                          {line.content}
                        </div>
                        <button
                          onClick={() => copyLineToClipboard(line.content, index + 10000)}
                          className="opacity-0 group-hover:opacity-100 px-2 text-[--hl] hover:text-[--color-font]"
                          title="Copy line"
                        >
                          <Icon icon={copiedLineIndex === index + 10000 ? 'check' : 'copy'} className="text-xs" />
                        </button>
                      </div>
                    );
                  }
                  return <div key={`tgt-empty-${index}`} className="h-6 bg-gray-50" />;
                })}
              </div>
            </div>
          </div>
        ) : (
          // Unified view
          <div className="font-mono text-sm pb-16">
            {filteredDiffLines.map((line, index) => {
          // Handle separator lines
          if (line.type === 'separator') {
            // Large gap (10+ lines): show full separator
            if (line.skippedLines && line.skippedLines >= 10) {
              return (
                <div
                  key={`separator-${index}`}
                  className="flex items-center justify-center py-3 bg-[--hl-xs] border-y border-[--hl-md] my-2"
                >
                  <Icon icon="ellipsis-h" className="text-[--hl] mr-2" />
                  <span className="text-[--hl] text-xs italic">{line.content}</span>
                </div>
              );
            }
            // Small gap (1-9 lines): just add spacing
            return (
              <div key={`spacing-${index}`} className="h-4" />
            );
          }

          // Handle regular diff lines
          return (
            <div
              key={`${line.type}-${line.lineNumber || index}-${line.content.slice(0, 20)}`}
              className={`group flex ${
                line.type === 'added' ? 'bg-green-50 dark:bg-green-900/20' :
                line.type === 'removed' ? 'bg-red-50 dark:bg-red-900/20' :
                'bg-[--hl-xs]'
              }`}
            >
              <div className={`w-12 px-2 py-1 text-right select-none border-r border-[--hl-md] text-[--hl] ${
                line.type === 'added' ? 'bg-green-100 dark:bg-green-900/30' :
                line.type === 'removed' ? 'bg-red-100 dark:bg-red-900/30' :
                'bg-[--hl-xs]'
              }`}>
                {line.lineNumber || ''}
              </div>
              <div className={`w-4 px-1 py-1 text-center select-none ${
                line.type === 'added' ? 'text-green-600 bg-green-100 dark:bg-green-900/30' :
                line.type === 'removed' ? 'text-red-600 bg-red-100 dark:bg-red-900/30' :
                ''
              }`}>
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ''}
              </div>
              <div className={`flex-1 px-3 py-1 whitespace-pre-wrap ${
                line.type === 'added' ? 'text-green-800 dark:text-green-200' :
                line.type === 'removed' ? 'text-red-800 dark:text-red-200' :
                'text-[--color-font]'
              }`}>
                {line.content}
              </div>
              {/* Copy button - visible on hover */}
              <button
                onClick={() => copyLineToClipboard(line.content, index)}
                className="opacity-0 group-hover:opacity-100 px-2 text-[--hl] hover:text-[--color-font] transition-opacity"
                title="Copy line"
              >
                <Icon icon={copiedLineIndex === index ? 'check' : 'copy'} className="text-xs" />
              </button>
            </div>
          );
        })}
            </div>
          )}
        </div>

        {filteredDiffLines.length === 0 && !searchQuery && (
          <div className="p-4 text-center text-[--hl]">
            <Icon icon="check-circle" className="text-green-500 text-2xl mb-2" />
          <p>No differences found in response bodies</p>
          <p className="text-sm mt-1">The JSON responses are identical</p>
        </div>
      )}
    </div>
  );
};

interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header' | 'separator';
  content: string;
  lineNumber?: number;
  skippedLines?: number; // For separator lines - how many lines were skipped
}

async function generateUnifiedDiff(sourceResponse: any, targetResponse: any): Promise<DiffLine[]> {
  try {
    // Extract and format JSON from responses
    const sourceJson = await getFormattedResponseBody(sourceResponse);
    const targetJson = await getFormattedResponseBody(targetResponse);

    if (!sourceJson && !targetJson) {
      return [{
        type: 'header',
        content: 'No response bodies to compare'
      }];
    }

    const sourceLines = sourceJson ? sourceJson.split('\n') : [];
    const targetLines = targetJson ? targetJson.split('\n') : [];

    // Line-by-line diff algorithm - ONLY SHOW DIFFERENCES with smart spacing
    const diffLines: DiffLine[] = [];

    let sourceIndex = 0;
    let targetIndex = 0;
    let lineNumber = 1;
    let lastDiffLineNumber = 0; // Track the last line number where we added a diff

    while (sourceIndex < sourceLines.length || targetIndex < targetLines.length) {
      const sourceLine = sourceIndex < sourceLines.length ? sourceLines[sourceIndex] : null;
      const targetLine = targetIndex < targetLines.length ? targetLines[targetIndex] : null;

      if (sourceLine === targetLine) {
        // Lines match - skip (don't show context)
        sourceIndex++;
        targetIndex++;
        lineNumber++;
      } else {
        // Check if we need to add a separator for skipped lines
        if (lastDiffLineNumber > 0) {
          const skippedLines = lineNumber - lastDiffLineNumber - 1;
          if (skippedLines >= 10) {
            // Large gap: add separator line
            diffLines.push({
              type: 'separator',
              content: `... ${skippedLines} unchanged lines ...`,
              skippedLines: skippedLines
            });
          } else if (skippedLines > 0) {
            // Small gap: add a marker for spacing (will be rendered with margin)
            diffLines.push({
              type: 'separator',
              content: '',
              skippedLines: skippedLines
            });
          }
        }

        // Lines differ - check if it's an addition, deletion, or modification
        if (sourceLine !== null && targetLine !== null) {
          // Both exist but differ - show as removed then added
          diffLines.push({
            type: 'removed',
            content: sourceLine,
            lineNumber: lineNumber
          });
          diffLines.push({
            type: 'added',
            content: targetLine,
            lineNumber: lineNumber
          });
          sourceIndex++;
          targetIndex++;
          lineNumber++;
        } else if (sourceLine !== null) {
          // Only source exists - line was removed
          diffLines.push({
            type: 'removed',
            content: sourceLine,
            lineNumber: lineNumber
          });
          sourceIndex++;
          lineNumber++;
        } else if (targetLine !== null) {
          // Only target exists - line was added
          diffLines.push({
            type: 'added',
            content: targetLine,
            lineNumber: lineNumber
          });
          targetIndex++;
          lineNumber++;
        }

        lastDiffLineNumber = lineNumber - 1;
      }
    }

    return diffLines;
  } catch (error) {
    console.error('Failed to generate diff:', error);
    return [{
      type: 'header',
      content: 'Failed to generate diff - responses may not be valid JSON'
    }];
  }
}

async function getFormattedResponseBody(response: any): Promise<string | null> {
  try {
    if (!response) {
      return null;
    }

    // Get the response body buffer
    const bodyBuffer = await models.response.getBodyBuffer(response);
    if (!bodyBuffer) {
      return null;
    }

    // Convert buffer to string
    const bodyText = bodyBuffer.toString('utf8');

    // Try to parse and reformat as pretty JSON
    try {
      const parsed = JSON.parse(bodyText);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, return as-is
      return bodyText;
    }
  } catch (error) {
    console.error('Failed to format response body:', error);
    return null;
  }
}

export default Runner;

// This is required for tracking the active request for one runner execution
// Then in runner cancellation, both the active request and the runner execution will be canceled
// TODO(george): Potentially it could be merged with maps in request-timing.ts and cancellation.ts
interface ExecutionInfo {
  activeRequestId?: string;
  error?: string;
}
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
const wrapAroundIterationOverIterationData = (
  list?: UserUploadEnvironment[],
  currentIteration?: number,
): UserUploadEnvironment | undefined => {
  if (currentIteration === undefined || !Array.isArray(list) || list.length === 0) {
    return undefined;
  }
  if (list.length >= currentIteration + 1) {
    return list[currentIteration];
  }
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
export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'Organization id is required');
  invariant(projectId, 'Project id is required');
  invariant(workspaceId, 'Workspace id is required');

  const { requests, iterationCount, delay, userUploadEnvs, bail, targetFolderId, keepLog } =
    (await request.json()) as runCollectionActionParams;

  const runnerId = targetFolderId ? targetFolderId : workspaceId;

  let testCtx: CollectionRunnerContext = {
    source: 'runner',
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
    appendTimeline: async (_timelinePath: string, _logs: string[]) => {}, // no op
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

          const activeRequestMeta = await models.requestMeta.updateOrCreateByParentId(targetRequest.id, {
            lastActive: Date.now(),
          });
          invariant(activeRequestMeta, 'Request meta not found');

          await new Promise(resolve => setTimeout(resolve, delay));

          const mutatedContext = (await sendActionImplementation({
            requestId: targetRequest.id,
            iteration: i + 1,
            iterationCount,
            userUploadEnvironment: wrapAroundIterationOverIterationData(userUploadEnvs, i),
            shouldPromptForPathAfterResponse: false,
            ignoreUndefinedEnvVariable: true,
            testResultCollector: resultCollector,
            runtime,
            transientVariables: testCtx.transientVariables,
          })) as RequestContext | null;
          if (mutatedContext?.execution?.nextRequestIdOrName) {
            nextRequestIdOrName = mutatedContext.execution.nextRequestIdOrName || '';
          }

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
}
