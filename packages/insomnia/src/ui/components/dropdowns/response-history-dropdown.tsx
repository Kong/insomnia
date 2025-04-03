import { differenceInHours, differenceInMinutes, isThisWeek, isToday } from 'date-fns';
import React, { useCallback, useRef } from 'react';
import { Button } from 'react-aria-components';
import { useFetcher, useRouteLoaderData } from 'react-router-dom';
import { useParams } from 'react-router-dom';

import { decompressObject } from '../../../common/misc';
import * as models from '../../../models/index';
import { isRequest, type Request } from '../../../models/request';
import type { Response } from '../../../models/response';
import type { WebSocketRequest } from '../../../models/websocket-request';
import { isWebSocketResponse, type WebSocketResponse } from '../../../models/websocket-response';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import type { RequestLoaderData, WebSocketRequestLoaderData } from '../../routes/request';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { URLTag } from '../tags/url-tag';
import { TimeFromNow } from '../time-from-now';

export const ResponseHistoryDropdown = ({
  activeResponse,
}: { activeResponse: Response | WebSocketResponse }) => {
  const { requestId } = useParams() as { requestId: string };
  const dropdownRef = useRef<DropdownHandle>(null);
  const patchRequestMeta = useRequestMetaPatcher();
  const {
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const {
    responses,
    requestVersions,
  } = useRouteLoaderData('request/:requestId') as RequestLoaderData | WebSocketRequestLoaderData;
  const now = new Date();
  const categories: Record<string, (Response | WebSocketResponse)[]> = {
    minutes: [],
    hours: [],
    today: [],
    week: [],
    other: [],
  };

  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const fetcher = useFetcher();

  const handleSetActiveResponse = useCallback(async (requestId: string, activeResponse: Response | WebSocketResponse) => {
    if (isWebSocketResponse(activeResponse)) {
      window.main.webSocket.close({ requestId });
    }

    if (activeResponse.requestVersionId) {
      await models.requestVersion.restore(activeResponse.requestVersionId);
    }

    await patchRequestMeta(requestId, { activeResponseId: activeResponse._id });
  }, [patchRequestMeta]);

  const handleDeleteResponses = useCallback(async () => {
    if (isWebSocketResponse(activeResponse)) {
      window.main.webSocket.close({ requestId });
    }
    fetcher.submit({}, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/response/delete-all`,
      method: 'post',
      encType: 'application/json',
    });
  }, [activeResponse, fetcher, organizationId, projectId, requestId, workspaceId]);

  const handleDeleteResponse = useCallback(async () => {
    if (activeResponse) {
      if (isWebSocketResponse(activeResponse)) {
        window.main.webSocket.close({ requestId });
      }
    }
    fetcher.submit({ responseId: activeResponse._id }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}/response/delete`,
      method: 'post',
      encType: 'application/json',
    });
  }, [activeResponse, fetcher, requestId, organizationId, projectId, workspaceId]);

  responses.forEach((response: Response | WebSocketResponse) => {
    const responseTime = new Date(response.created);
    const match = Object.entries({
      'minutes': differenceInMinutes(now, responseTime) < 5,
      'hours': differenceInHours(now, responseTime) < 2,
      'today': isToday(responseTime),
      'week': isThisWeek(responseTime),
      'other': true,
    }).find(([, value]) => value === true)?.[0] || 'other';
    categories[match].push(response);
  });

  const renderResponseRow = (response: Response | WebSocketResponse) => {
    const activeResponseId = activeResponse ? activeResponse._id : 'n/a';
    const active = response._id === activeResponseId;
    const requestVersion = requestVersions.find(({ _id }) => _id === response.requestVersionId);
    const request = requestVersion ? decompressObject<Request | WebSocketRequest>(requestVersion.compressedRequest) : null;

    return (
      <DropdownItem
        key={response._id}
        aria-label={response._id}
      >
        <ItemContent
          isDisabled={active}
          icon={active ? 'thumb-track' : 'empty'}
          onClick={() => handleSetActiveResponse(requestId, response)}
          label={
            <div className='leading-10'>
              <StatusTag
                small
                statusCode={response.statusCode}
                statusMessage={response.statusMessage || undefined}
                tooltipDelay={1000}
              />
              <URLTag
                small
                url={request?.url || ''}
                method={request && isRequest(request) ? request.method : ''}
                tooltipDelay={1000}
              />
              <TimeTag milliseconds={response.elapsedTime} small tooltipDelay={1000} />
              {!isWebSocketResponse(response) && (
                <SizeTag
                  bytesRead={response.bytesRead}
                  bytesContent={response.bytesContent}
                  small
                  tooltipDelay={1000}
                />
              )}
              {!response.requestVersionId ?
                <i
                  className="icon fa fa-info-circle"
                  title={'Request will not be restored with this response because it was created before this ability was added'}
                />
                : null}
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
    <Dropdown
      ref={dropdownRef}
      aria-label="Response history dropdown"
      key={activeResponse ? activeResponse._id : 'n/a'}
      closeOnSelect={false}
      className="tall pane__header__right"
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
        title={<span><strong>{environmentName}</strong> Responses</span>}
      >
        <DropdownItem aria-label='Delete Current Response'>
          <ItemContent
            icon="trash-o"
            label="Delete Current Response"
            onClick={handleDeleteResponse}
          />
        </DropdownItem>
        <DropdownItem aria-label='Clear History'>
          <ItemContent
            icon="trash-o"
            label="Clear History"
            onClick={handleDeleteResponses}
          />
        </DropdownItem>
      </DropdownSection>

      <DropdownSection
        aria-label='Minutes Section'
        title="Just Now"
      >
        {categories.minutes.map(renderResponseRow)}
      </DropdownSection>

      <DropdownSection
        aria-label='Hours Section'
        title="Less Than Two Hours Ago"
      >
        {categories.hours.map(renderResponseRow)}
      </DropdownSection>

      <DropdownSection
        aria-label='Today Section'
        title="Today"
      >
        {categories.today.map(renderResponseRow)}
      </DropdownSection>

      <DropdownSection
        aria-label='Week Section'
        title="This Week"
      >
        {categories.week.map(renderResponseRow)}
      </DropdownSection>

      <DropdownSection
        aria-label='Other Section'
        title="Older Than This Week"
      >
        {categories.other.map(renderResponseRow)}
      </DropdownSection>
    </Dropdown>
  );
};
