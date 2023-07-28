import { differenceInHours, differenceInMinutes, isThisWeek, isToday } from 'date-fns';
import React, { useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useRouteLoaderData } from 'react-router-dom';
import { useParams } from 'react-router-dom';

import { decompressObject } from '../../../common/misc';
import * as models from '../../../models/index';
import { isRequest, Request } from '../../../models/request';
import { Response } from '../../../models/response';
import { WebSocketRequest } from '../../../models/websocket-request';
import { isWebSocketResponse, WebSocketResponse } from '../../../models/websocket-response';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { selectActiveRequestResponses, selectRequestVersions } from '../../redux/selectors';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { URLTag } from '../tags/url-tag';
import { TimeFromNow } from '../time-from-now';
interface Props<GenericResponse extends Response | WebSocketResponse> {
  activeResponse: GenericResponse;
  className?: string;
}

export const ResponseHistoryDropdown = <GenericResponse extends Response | WebSocketResponse>({
  activeResponse,
  className,
}: Props<GenericResponse>) => {
  const { requestId } = useParams() as { requestId: string };
  const dropdownRef = useRef<DropdownHandle>(null);
  const patchRequestMeta = useRequestMetaPatcher();
  const {
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const responses = useSelector(selectActiveRequestResponses) as GenericResponse[];
  const requestVersions = useSelector(selectRequestVersions);
  const now = new Date();
  const categories: Record<string, GenericResponse[]> = {
    minutes: [],
    hours: [],
    today: [],
    week: [],
    other: [],
  };

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
      window.main.webSocket.closeAll();
      await models.webSocketResponse.removeForRequest(requestId, activeEnvironment._id);
    } else {
      await models.response.removeForRequest(requestId, activeEnvironment._id);
    }
    await patchRequestMeta(requestId, { activeResponseId: null });
  }, [activeEnvironment._id, activeResponse, requestId, patchRequestMeta]);

  const handleDeleteResponse = useCallback(async () => {
    let response: Response | WebSocketResponse | null = null;
    if (activeResponse) {
      if (isWebSocketResponse(activeResponse)) {
        window.main.webSocket.close({ requestId });
        await models.webSocketResponse.remove(activeResponse);
        const environmentId = activeEnvironment?._id || null;
        response = await models.webSocketResponse.getLatestForRequest(requestId, environmentId);
      } else {
        await models.response.remove(activeResponse);
        const environmentId = activeEnvironment?._id || null;
        response = await models.response.getLatestForRequest(requestId, environmentId);
      }

      if (response?.requestVersionId) {
        // Deleting a response restores latest request body
        await models.requestVersion.restore(response.requestVersionId);
      }

      await patchRequestMeta(requestId, { activeResponseId: response?._id || null });
    }
  }, [activeEnvironment?._id, activeResponse, requestId, patchRequestMeta]);

  responses.forEach(response => {
    const responseTime = new Date(response.created);

    if (differenceInMinutes(now, responseTime) < 5) {
      categories.minutes.push(response);
      return;
    }

    if (differenceInHours(now, responseTime) < 2) {
      categories.hours.push(response);
      return;
    }

    if (isToday(responseTime)) {
      categories.today.push(response);
      return;
    }

    if (isThisWeek(responseTime)) {
      categories.week.push(response);
      return;
    }

    categories.other.push(response);
  });

  const renderResponseRow = (response: GenericResponse) => {
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
            <>
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
            </>
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
      className={className}
      triggerButton={
        <DropdownButton className="btn btn--super-compact tall" title="Response history">
          {activeResponse && <TimeFromNow timestamp={activeResponse.created} titleCase />}
          {!isLatestResponseActive ? (
            <i className="fa fa-thumb-tack space-left" />
          ) : (
            <i className="fa fa-caret-down space-left" />
          )}
        </DropdownButton>
      }
    >
      <DropdownSection
        aria-label={`${environmentName} Responses`}
        title={<span><strong>{environmentName}</strong> Responses</span>}
      >
        <DropdownItem aria-label='Delete Current Response'>
          <ItemContent
            icon="fa-trash-o"
            label="Delete Current Response"
            onClick={handleDeleteResponse}
          />
        </DropdownItem>
        <DropdownItem aria-label='Clear History'>
          <ItemContent
            icon="fa-trash-o"
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
