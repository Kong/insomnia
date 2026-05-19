import { fetchMockbinLogs, type MockbinLogOutput } from 'insomnia-api';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { Button, Tab, TabList, TabPanel, Tabs, Toolbar } from 'react-aria-components';
import * as reactUse from 'react-use';

import type { MockRoute, MockServer, Response } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { useRootLoaderData } from '~/root';
import { useRequestNewMockSendActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new-mock-send';
import { useMockRouteLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId';
import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';

import {
  getMockServiceURL,
  getPreviewModeName,
  PREVIEW_MODE_FRIENDLY,
  PREVIEW_MODES,
  type PreviewMode,
} from '../../../common/constants';
import { exportHarCurrentRequest } from '../../../common/har';
import type { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import { cancelRequestById } from '../../../network/cancellation';
import { jsonPrettify } from '../../../utils/prettify/json';
import { useExecutionState } from '../../hooks/use-execution-state';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Pane, PaneHeader } from '../panes/pane';
import { PlaceholderResponsePane } from '../panes/placeholder-response-pane';
import { ResponseTimer } from '../response-timer';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { getTimeFromNow } from '../time-from-now';
import { ResponseHeadersViewer } from '../viewers/response-headers-viewer';
import { ResponseTimelineViewer } from '../viewers/response-timeline-viewer';
import { ResponseViewer } from '../viewers/response-viewer';

const { useInterval } = reactUse;

export const MockResponsePane = () => {
  const { mockServer, mockRoute, activeResponse } = useMockRouteLoaderData()!;
  const { settings } = useRootLoaderData()!;
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>([]);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(PREVIEW_MODE_FRIENDLY);
  const requestFetcher = useRequestNewMockSendActionFetcher({ key: 'mock-request-fetcher' });
  const { steps } = useExecutionState({ requestId: activeResponse?.parentId });

  useEffect(() => {
    const fn = async () => {
      if (activeResponse) {
        const timeline = await services.helpers.getResponseTimeline(activeResponse, true);
        setTimeline(timeline);
      }
    };
    fn();
  }, [activeResponse]);
  if (requestFetcher.state !== 'idle') {
    return (
      <PlaceholderResponsePane>
        {
          <ResponseTimer
            handleCancel={() => activeResponse && cancelRequestById(activeResponse.parentId)}
            activeRequestId={mockRoute._id}
            steps={steps}
          />
        }
      </PlaceholderResponsePane>
    );
  }
  return (
    <Pane type="response">
      {!activeResponse ? null : (
        <PaneHeader className="row-spaced">
          <div aria-atomic="true" aria-live="polite" className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={activeResponse.statusCode} statusMessage={activeResponse.statusMessage} />
            <TimeTag milliseconds={activeResponse.elapsedTime} steps={[]} />
            <SizeTag bytesRead={activeResponse.bytesRead} bytesContent={activeResponse.bytesContent} />
          </div>
        </PaneHeader>
      )}
      <Tabs aria-label="Mock response" className="flex h-full w-full flex-1 flex-col">
        <TabList
          className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
          aria-label="Request pane tabs"
        >
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="preview"
          >
            Preview
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="headers"
          >
            Headers
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="timeline"
          >
            Console
          </Tab>
          <Tab
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
            id="history"
          >
            History
          </Tab>
        </TabList>
        <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="preview">
          <Toolbar className="flex h-(--line-height-sm) w-full shrink-0 items-center border-b border-solid border-(--hl-md) px-2">
            {activeResponse ? (
              <PreviewModeDropdown
                activeResponse={activeResponse}
                previewMode={previewMode}
                setPreviewMode={setPreviewMode}
              />
            ) : null}
          </Toolbar>
          {activeResponse && (
            <ResponseViewer
              key={activeResponse._id}
              bytes={Math.max(activeResponse.bytesContent, activeResponse.bytesRead)}
              contentType={activeResponse.contentType || ''}
              disableHtmlPreviewJs={settings.disableHtmlPreviewJs}
              disablePreviewLinks={settings.disableResponsePreviewLinks}
              download={() => {}}
              editorFontSize={settings.editorFontSize}
              error={activeResponse.error}
              filter={''}
              filterHistory={[]}
              bodyBuffer={activeResponse.bodyBuffer}
              getBody={() => services.helpers.getResponseBodyBuffer(activeResponse)}
              previewMode={previewMode}
              responseId={activeResponse._id}
              updateFilter={activeResponse.error ? undefined : () => {}}
              url={activeResponse.url}
            />
          )}
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="headers">
          <ResponseHeadersViewer headers={activeResponse?.headers || []} />
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="timeline">
          <ResponseTimelineViewer key={activeResponse?._id} timeline={timeline} pinToBottom={true} />
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="history">
          <HistoryViewWrapperComponentFactory mockServer={mockServer} mockRoute={mockRoute} />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};

const HistoryViewWrapperComponentFactory = ({
  mockServer,
  mockRoute,
}: {
  mockServer: MockServer;
  mockRoute: MockRoute;
}) => {
  const [logs, setLogs] = useState<MockbinLogOutput | null>(null);
  const [logEntryId, setLogEntryId] = useState<number | null>(null);
  const { userSession } = useRootLoaderData()!;

  const fetchLogs = useCallback(async () => {
    const compoundId = mockRoute.parentId + mockRoute.name;
    const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;
    try {
      const res = await fetchMockbinLogs({
        mockbinUrl,
        compoundId,
        method: mockRoute.method,
        sessionId: userSession.id,
      });
      if (res?.log) {
        setLogs(res);
        return;
      }
      console.log('[mock] Error: fetching logs from remote', { mockbinUrl, res });
    } catch (e) {
      // network errors will be managed by the upsert trigger, so we can ignore them here
      console.log({ mockbinUrl, e });
    }
  }, [
    mockRoute.method,
    mockRoute.name,
    mockRoute.parentId,
    mockServer.url,
    mockServer.useInsomniaCloud,
    userSession.id,
  ]);
  // refetches logs whenever the path changes, or a response is received, or tenseconds elapses or history tab is click
  // chatgpt: answer my called
  useInterval(() => {
    fetchLogs();
  }, 10_000);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="grid h-full w-full grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
      <div className="box-border w-full flex-1 overflow-hidden overflow-y-scroll">
        <div className="grid grid-cols-[repeat(5,auto)] divide-y divide-solid divide-(--hl-sm)">
          <div className="bg-(--hl-sm) p-2 text-left text-xs font-semibold uppercase focus:outline-hidden">Method</div>
          <div className="bg-(--hl-sm) p-2 text-left text-xs font-semibold uppercase focus:outline-hidden">Size</div>
          <div className="bg-(--hl-sm) p-2 text-left text-xs font-semibold uppercase focus:outline-hidden">Date</div>
          <div className="bg-(--hl-sm) p-2 text-left text-xs font-semibold uppercase focus:outline-hidden">IP</div>
          <div className="bg-(--hl-sm) p-2 text-left text-xs font-semibold uppercase focus:outline-hidden">Path</div>
          {logs?.log.entries
            ?.map((row, index) => (
              <Fragment key={row.startedDateTime}>
                <div
                  onClick={() => setLogEntryId(index)}
                  className={`${index % 2 === 0 ? '' : 'bg-(--hl-xs)'} cursor-pointer truncate text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden`}
                >
                  <div className="p-2">{row.request.method}</div>
                </div>
                <div
                  onClick={() => setLogEntryId(index)}
                  className={`${index % 2 === 0 ? '' : 'bg-(--hl-xs)'} cursor-pointer truncate text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden`}
                >
                  <div className="p-2">{row.request.bodySize + row.request.headersSize}</div>
                </div>
                <div
                  onClick={() => setLogEntryId(index)}
                  className={`${index % 2 === 0 ? '' : 'bg-(--hl-xs)'} cursor-pointer truncate text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden`}
                >
                  <div className="truncate p-2">{getTimeFromNow(row.startedDateTime, false)}</div>
                </div>
                <div
                  onClick={() => setLogEntryId(index)}
                  className={`${index % 2 === 0 ? '' : 'bg-(--hl-xs)'} cursor-pointer truncate text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden`}
                >
                  <div className="truncate p-2">{row.clientIPAddress}</div>
                </div>
                <div
                  onClick={() => setLogEntryId(index)}
                  className={`${index % 2 === 0 ? '' : 'bg-(--hl-xs)'} cursor-pointer truncate text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden`}
                >
                  <div className="truncate p-2">{row.request.url}</div>
                </div>
              </Fragment>
            ))
            .reverse()}
        </div>
      </div>
      {logEntryId !== null && logs?.log.entries?.[logEntryId] && (
        <div className="h-full flex-1 border border-solid border-(--hl-md)">
          <CodeEditor
            id="log-body-preview"
            key={logEntryId + logs?.log.entries?.[logEntryId].startedDateTime}
            hideLineNumbers
            mode={'text/json'}
            defaultValue={JSON.stringify(logs?.log.entries?.[logEntryId], null, '\t')}
            readOnly
          />
        </div>
      )}
    </div>
  );
};

const PreviewModeDropdown = ({
  activeResponse,
  previewMode,
  setPreviewMode,
}: {
  activeResponse: Response;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
}) => {
  return (
    <Dropdown
      aria-label="Preview Mode Dropdown"
      triggerButton={
        <Button className="text-(--hl)">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </Button>
      }
    >
      <DropdownSection aria-label="Preview Mode Section" title="Preview Mode">
        {PREVIEW_MODES.map(mode => (
          <DropdownItem key={mode} aria-label={getPreviewModeName(mode, true)}>
            <ItemContent
              icon={previewMode === mode ? 'check' : 'empty'}
              label={getPreviewModeName(mode, true)}
              onClick={() => setPreviewMode(mode)}
            />
          </DropdownItem>
        ))}
      </DropdownSection>
      <DropdownSection aria-label="Action Section" title="Action">
        <DropdownItem aria-label="Copy raw response">
          <ItemContent
            icon="copy"
            label="Copy raw response"
            onClick={async () => {
              const bodyBuffer = await services.helpers.getResponseBodyBuffer(activeResponse);
              bodyBuffer && window.clipboard.writeText(bodyBuffer.toString('utf8'));
            }}
          />
        </DropdownItem>
        <DropdownItem aria-label="Export raw response">
          <ItemContent
            icon="save"
            label="Export raw response"
            onClick={async () => {
              const { canceled, filePath } = await window.dialog.showSaveDialog({
                title: 'Save Full Response',
                buttonLabel: 'Save',
                defaultPath: `response-${Date.now()}.txt`,
              });

              if (canceled || !filePath || !activeResponse.bodyBuffer) {
                return;
              }
              await window.main.writeFile({
                path: filePath,
                content: activeResponse.bodyBuffer?.toString('utf8') || '',
              });
            }}
          />
        </DropdownItem>
        <DropdownItem aria-label="Export prettified response">
          {activeResponse.contentType.includes('json') && (
            <ItemContent
              icon="save"
              label="Export prettified response"
              onClick={async () => {
                const bodyBuffer = await services.helpers.getResponseBodyBuffer(activeResponse);
                const { canceled, filePath } = await window.dialog.showSaveDialog({
                  title: 'Save Full Response',
                  buttonLabel: 'Save',
                  defaultPath: `response-${Date.now()}.txt`,
                });

                if (canceled || !filePath || !bodyBuffer) {
                  return;
                }
                await window.main.writeFile({
                  path: filePath,
                  content: jsonPrettify(activeResponse.bodyBuffer?.toString('utf8')) || '',
                });
              }}
            />
          )}
        </DropdownItem>
        <DropdownItem aria-label="Export HTTP debug">
          <ItemContent
            icon="bug"
            label="Export HTTP debug"
            onClick={async () => {
              const { canceled, filePath } = await window.dialog.showSaveDialog({
                title: 'Save Full Response',
                buttonLabel: 'Save',
                defaultPath: `response-${Date.now()}.txt`,
              });

              if (canceled || !filePath) {
                return;
              }
              const timeline = await services.helpers.getResponseTimeline(activeResponse);
              const headers = timeline
                .filter(v => v.name === 'HeaderIn')
                .map(v => v.value)
                .join('');

              await window.main.writeFile({
                path: filePath,
                content: headers,
              });
            }}
          />
        </DropdownItem>
        <DropdownItem aria-label="Export as HAR">
          <ItemContent
            icon="save"
            label="Export as HAR"
            onClick={async () => {
              const activeRequest = await services.request.getById(activeResponse.parentId);
              const { canceled, filePath } = await window.dialog.showSaveDialog({
                title: 'Save Full Response',
                buttonLabel: 'Save',
                defaultPath: `response-${Date.now()}.txt`,
              });

              if (canceled || !filePath || !activeRequest) {
                return;
              }
              const data = await exportHarCurrentRequest(activeRequest, activeResponse);
              const har = JSON.stringify(data, null, '\t');

              await window.main.writeFile({
                path: filePath,
                content: har,
              });
            }}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
