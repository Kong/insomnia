import { differenceInHours, differenceInMinutes, isThisWeek, isToday } from 'date-fns';
import type {
  McpResponse,
  Request,
  RequestVersion,
  Response,
  SocketIOResponse,
  WebSocketRequest,
  WebSocketResponse,
} from 'insomnia-data';
import { models, services } from 'insomnia-data';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { useParams } from 'react-router';

import { useRequestResponseDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete';
import { useRequestResponseDeleteAllActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.response.delete-all';

import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { SizeTag } from '../tags/size-tag';
import { StatusTag, StringStatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { URLTag } from '../tags/url-tag';
import { TimeFromNow } from '../time-from-now';
import {
  dismissResponseHistoryHint,
  HINT_DURATION_MS,
  isResponseHistoryHintDismissed,
  REQUEST_CONTENT_EDITED_EVENT,
  type RequestContentEditedDetail,
} from './response-history-hint';

const { isRequest } = models.request;

type ResponseType = Response | WebSocketResponse | SocketIOResponse | McpResponse;

// The hint is a one-time nudge per window session; "Don't show again" persists
// in localStorage.
let hintShownThisSession = false;

export const ResponseHistoryDropdown = ({
  activeResponse,
  responses,
  requestVersions,
}: {
  activeResponse: ResponseType;
  responses: ResponseType[];
  requestVersions: RequestVersion[];
}) => {
  const { organizationId, projectId, workspaceId, requestId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
  };
  const dropdownRef = useRef<DropdownHandle>(null);
  const patchRequestMeta = useRequestMetaPatcher();
  const { activeEnvironment } = useWorkspaceLoaderData()!;
  const [isHintDismissed, setIsHintDismissed] = useState(isResponseHistoryHintDismissed);
  const [isHintVisible, setIsHintVisible] = useState(false);
  const hintTimer = useRef<number | null>(null);
  const hasRestorableHistory = responses.some(response => Boolean(response.requestVersionId));
  const now = new Date();
  const categories: Record<string, ResponseType[]> = {
    minutes: [],
    hours: [],
    today: [],
    week: [],
    other: [],
  };
  const [requestsByVersionId, setRequestsByVersionId] = useState<Record<string, Request | WebSocketRequest | null>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        requestVersions.map(async rv => {
          const req = await services.requestVersion.getRequest<Request | WebSocketRequest>(rv);
          return [rv._id, req] as const;
        }),
      );
      if (!cancelled) {
        setRequestsByVersionId(Object.fromEntries(entries));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [requestVersions]);

  const showHint = useCallback(() => {
    setIsHintVisible(true);
    if (hintTimer.current !== null) {
      window.clearTimeout(hintTimer.current);
    }
    hintTimer.current = window.setTimeout(() => setIsHintVisible(false), HINT_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (hintTimer.current !== null) {
        window.clearTimeout(hintTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    // The hint describes the request this dropdown belongs to, so drop it when the
    // user moves to another request.
    setIsHintVisible(false);
  }, [requestId]);

  useEffect(() => {
    const onContentEdited = (event: Event) => {
      const detail = (event as CustomEvent<RequestContentEditedDetail>).detail;
      if (detail?.requestId !== requestId) {
        return;
      }
      if (!hasRestorableHistory || isHintDismissed || hintShownThisSession) {
        return;
      }
      hintShownThisSession = true;
      showHint();
    };
    window.addEventListener(REQUEST_CONTENT_EDITED_EVENT, onContentEdited);
    return () => window.removeEventListener(REQUEST_CONTENT_EDITED_EVENT, onContentEdited);
  }, [requestId, hasRestorableHistory, isHintDismissed, showHint]);

  const hideHintPermanently = useCallback(() => {
    dismissResponseHistoryHint();
    setIsHintDismissed(true);
    setIsHintVisible(false);
  }, []);

  const deleteReponseFetcher = useRequestResponseDeleteActionFetcher();
  const deleteAllReponsesFetcher = useRequestResponseDeleteAllActionFetcher();

  const handleSetActiveResponse = useCallback(
    async (requestId: string, activeResponse: ResponseType) => {
      if (models.webSocketResponse.isWebSocketResponse(activeResponse)) {
        window.main.webSocket.close({ requestId });
      }

      if (models.socketIOResponse.isSocketIOResponse(activeResponse)) {
        window.main.socketIO.close({ requestId });
      }

      if (models.mcpResponse.isMcpResponse(activeResponse)) {
        window.main.mcp.close({ requestId });
      }

      if (activeResponse.requestVersionId) {
        await services.requestVersion.restore(activeResponse.requestVersionId);
      }

      await patchRequestMeta(requestId, { activeResponseId: activeResponse._id });
    },
    [patchRequestMeta],
  );

  const deleteResponsesSubmit = deleteAllReponsesFetcher.submit;
  const handleDeleteResponses = useCallback(async () => {
    if (models.webSocketResponse.isWebSocketResponse(activeResponse)) {
      window.main.webSocket.close({ requestId });
    } else if (models.socketIOResponse.isSocketIOResponse(activeResponse)) {
      window.main.socketIO.close({ requestId });
    } else if (models.mcpResponse.isMcpResponse(activeResponse)) {
      window.main.mcp.close({ requestId });
    }
    deleteResponsesSubmit({
      organizationId,
      projectId,
      workspaceId,
      requestId,
    });
  }, [activeResponse, deleteResponsesSubmit, organizationId, projectId, requestId, workspaceId]);

  const deleteResponseSubmit = deleteReponseFetcher.submit;
  const handleDeleteResponse = useCallback(async () => {
    if (activeResponse) {
      if (models.webSocketResponse.isWebSocketResponse(activeResponse)) {
        window.main.webSocket.close({ requestId });
      } else if (models.socketIOResponse.isSocketIOResponse(activeResponse)) {
        window.main.socketIO.close({ requestId });
      } else if (models.mcpResponse.isMcpResponse(activeResponse)) {
        window.main.mcp.close({ requestId });
      }
    }
    deleteResponseSubmit({ organizationId, projectId, workspaceId, requestId, responseId: activeResponse._id });
  }, [activeResponse, deleteResponseSubmit, organizationId, projectId, workspaceId, requestId]);

  responses.forEach(response => {
    const responseTime = new Date(response.created);
    const match =
      Object.entries({
        minutes: differenceInMinutes(now, responseTime) < 5,
        hours: differenceInHours(now, responseTime) < 2,
        today: isToday(responseTime),
        week: isThisWeek(responseTime),
        other: true,
      }).find(([, value]) => value === true)?.[0] || 'other';
    categories[match].push(response);
  });

  const renderResponseRow = (response: ResponseType) => {
    const activeResponseId = activeResponse ? activeResponse._id : 'n/a';
    const active = response._id === activeResponseId;
    const requestVersion = requestVersions.find(({ _id }) => _id === response.requestVersionId);
    const request = requestVersion ? (requestsByVersionId[requestVersion._id] ?? null) : null;

    return (
      <DropdownItem key={response._id} aria-label={response._id}>
        <ItemContent
          isDisabled={active}
          icon={active ? 'thumb-track' : 'empty'}
          onClick={() => handleSetActiveResponse(requestId, response)}
          label={
            <div className="leading-10">
              {models.socketIOResponse.isSocketIOResponse(response) ? null : models.mcpResponse.isMcpResponse(
                  response,
                ) && response.transportType === 'stdio' ? (
                <StringStatusTag
                  small
                  status={response.status}
                  statusMessage={response.statusMessage || undefined}
                  tooltipDelay={1000}
                />
              ) : (
                <StatusTag
                  small
                  statusCode={response.statusCode}
                  statusMessage={response.statusMessage || undefined}
                  tooltipDelay={1000}
                />
              )}
              <URLTag
                small
                url={request?.url || ''}
                method={request && isRequest(request) ? request.method : ''}
                tooltipDelay={1000}
              />
              <TimeTag milliseconds={response.elapsedTime} small tooltipDelay={1000} />
              {!models.webSocketResponse.isWebSocketResponse(response) &&
                !models.socketIOResponse.isSocketIOResponse(response) &&
                !models.mcpResponse.isMcpResponse(response) && (
                  <SizeTag
                    bytesRead={response.bytesRead}
                    bytesContent={response.bytesContent}
                    small
                    tooltipDelay={1000}
                  />
                )}
              {!response.requestVersionId ? (
                <i
                  className="icon fa fa-info-circle"
                  title={
                    'Request will not be restored with this response because it was created before this ability was added'
                  }
                />
              ) : null}
            </div>
          }
        />
      </DropdownItem>
    );
  };

  useDocBodyKeyboardShortcuts({
    request_toggleHistory: () => dropdownRef.current?.toggle(true),
  });

  const environmentName = activeEnvironment ? activeEnvironment.name : 'Base';
  const isLatestResponseActive = !responses.length || activeResponse._id === responses[0]._id;
  return (
    <div className="relative flex h-full">
      <Dropdown
        ref={dropdownRef}
        aria-label="Response history dropdown"
        key={activeResponse ? activeResponse._id : 'n/a'}
        closeOnSelect={false}
        className="tall pane__header__right"
        header={
          <p className="m-0 leading-snug text-pretty text-(--color-font)">
            Click any row to restore the Request and Response from that send. Unsent changes will be lost.
          </p>
        }
        triggerButton={
          <Button className="btn btn--super-compact tall">
            {activeResponse && <TimeFromNow timestamp={activeResponse.created} titleCase />}
            {!isLatestResponseActive ? (
              <i className="fa fa-thumb-tack space-left" />
            ) : (
              <i className="fa fa-caret-down space-left" />
            )}
          </Button>
        }
      >
        <DropdownSection
          aria-label={`${environmentName} Responses`}
          title={
            <span>
              <strong>{environmentName}</strong> Responses
            </span>
          }
        >
          <DropdownItem aria-label="Delete Current Response">
            <ItemContent icon="trash-o" label="Delete Current Response" onClick={handleDeleteResponse} />
          </DropdownItem>
          <DropdownItem aria-label="Clear History">
            <ItemContent icon="trash-o" label="Clear History" onClick={handleDeleteResponses} />
          </DropdownItem>
        </DropdownSection>

        <DropdownSection aria-label="Minutes Section" title="Just Now">
          {categories.minutes.map(renderResponseRow)}
        </DropdownSection>

        <DropdownSection aria-label="Hours Section" title="Less Than Two Hours Ago">
          {categories.hours.map(renderResponseRow)}
        </DropdownSection>

        <DropdownSection aria-label="Today Section" title="Today">
          {categories.today.map(renderResponseRow)}
        </DropdownSection>

        <DropdownSection aria-label="Week Section" title="This Week">
          {categories.week.map(renderResponseRow)}
        </DropdownSection>

        <DropdownSection aria-label="Other Section" title="Older Than This Week">
          {categories.other.map(renderResponseRow)}
        </DropdownSection>
      </Dropdown>
      {isHintVisible && (
        <div
          role="status"
          className="pointer-events-none absolute top-full right-0 z-10 mt-1 w-64 rounded-md border border-solid border-(--hl-md) bg-(--color-bg) p-(--padding-sm) text-xs text-(--color-font) shadow-md"
          data-testid="response-history-hint"
        >
          <p className="m-0 font-bold text-(--color-font)">Response History</p>
          <p className="m-0 mt-0.5">
            Click any past response to restore the Request and Response from that send. Unsent changes are lost.
          </p>
          <button
            type="button"
            className="pointer-events-auto mt-1 cursor-pointer text-(--hl) underline hover:text-(--color-font)"
            onClick={hideHintPermanently}
          >
            Don't show again
          </button>
        </div>
      )}
    </div>
  );
};
