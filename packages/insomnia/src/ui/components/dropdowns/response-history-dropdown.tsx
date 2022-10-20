import { differenceInHours, differenceInMinutes, isThisWeek, isToday } from 'date-fns';
import React, { Fragment, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';

import { decompressObject } from '../../../common/misc';
import * as models from '../../../models/index';
import { Response } from '../../../models/response';
import { isWebSocketResponse, WebSocketResponse } from '../../../models/websocket-response';
import { updateRequestMetaByParentId } from '../../hooks/create-request';
import { selectActiveEnvironment, selectActiveRequest, selectActiveRequestResponses, selectRequestVersions } from '../../redux/selectors';
import { type DropdownHandle, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { URLTag } from '../tags/url-tag';
import { TimeFromNow } from '../time-from-now';

interface Props<GenericResponse extends Response | WebSocketResponse> {
  activeResponse: GenericResponse;
  className?: string;
  requestId: string;
}

export const ResponseHistoryDropdown = <GenericResponse extends Response | WebSocketResponse>({
  activeResponse,
  className,
  requestId,
}: Props<GenericResponse>) => {
  const dropdownRef = useRef<DropdownHandle>(null);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const responses = useSelector(selectActiveRequestResponses) as GenericResponse[];
  const activeRequest = useSelector(selectActiveRequest);
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

    await updateRequestMetaByParentId(requestId, { activeResponseId: activeResponse._id });
  }, []);

  const handleDeleteResponses = useCallback(async () => {
    const environmentId = activeEnvironment ? activeEnvironment._id : null;
    if (isWebSocketResponse(activeResponse)) {
      window.main.webSocket.closeAll();
      await models.webSocketResponse.removeForRequest(requestId, environmentId);
    } else {
      await models.response.removeForRequest(requestId, environmentId);
    }
    if (activeRequest && activeRequest._id === requestId) {
      await updateRequestMetaByParentId(requestId, { activeResponseId: null });
    }
  }, [activeEnvironment, activeRequest, activeResponse, requestId]);

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

      await updateRequestMetaByParentId(requestId, { activeResponseId: response?._id || null });
    }
  }, [activeEnvironment?._id, activeResponse, requestId]);

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
    const request = requestVersion ? decompressObject(requestVersion.compressedRequest) : null;

    return (
      <DropdownItem
        key={response._id}
        disabled={active}
        onClick={() => handleSetActiveResponse(requestId, response)}
      >
        {active ? <i className="fa fa-thumb-tack" /> : <i className="fa fa-empty" />}{' '}
        <StatusTag
          small
          statusCode={response.statusCode}
          statusMessage={response.statusMessage || undefined}
          tooltipDelay={1000}
        />
        <URLTag
          small
          url={response.url}
          method={request ? request.method : ''}
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
      key={activeResponse ? activeResponse._id : 'n/a'}
      className={className}
    >
      <DropdownButton className="btn btn--super-compact tall" title="Response history">
        {activeResponse && <TimeFromNow timestamp={activeResponse.created} titleCase />}
        {!isLatestResponseActive ? (
          <i className="fa fa-thumb-tack space-left" />
        ) : (
          <i className="fa fa-caret-down space-left" />
        )}
      </DropdownButton>
      <DropdownDivider>
        <strong>{environmentName}</strong> Responses
      </DropdownDivider>
      <DropdownItem buttonClass={PromptButton} onClick={handleDeleteResponse}>
        <i className="fa fa-trash-o" />
        Delete Current Response
      </DropdownItem>
      <DropdownItem buttonClass={PromptButton} onClick={handleDeleteResponses}>
        <i className="fa fa-trash-o" />
        Clear History
      </DropdownItem>
      <Fragment>
        <DropdownDivider>Just Now</DropdownDivider>
        {categories.minutes.map(renderResponseRow)}
        <DropdownDivider>Less Than Two Hours Ago</DropdownDivider>
        {categories.hours.map(renderResponseRow)}
        <DropdownDivider>Today</DropdownDivider>
        {categories.today.map(renderResponseRow)}
        <DropdownDivider>This Week</DropdownDivider>
        {categories.week.map(renderResponseRow)}
        <DropdownDivider>Older Than This Week</DropdownDivider>
        {categories.other.map(renderResponseRow)}
      </Fragment>
    </Dropdown>
  );
};
