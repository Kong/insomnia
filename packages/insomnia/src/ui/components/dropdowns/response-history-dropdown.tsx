import { differenceInHours, differenceInMinutes, isThisWeek, isToday } from 'date-fns';
import React, { FC, Fragment, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';

import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { decompressObject } from '../../../common/misc';
import * as models from '../../../models/index';
import type { Response } from '../../../models/response';
import { selectActiveEnvironment, selectActiveRequest, selectActiveRequestResponses, selectRequestVersions } from '../../redux/selectors';
import { type DropdownHandle, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { KeydownBinder } from '../keydown-binder';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { URLTag } from '../tags/url-tag';
import { TimeFromNow } from '../time-from-now';

interface Props {
  activeResponse: Response;
  handleSetActiveResponse: (requestId: string, activeResponse: Response | null) => void;
  className?: string;
  requestId: string;
}

export const ResponseHistoryDropdown: FC<Props> = ({
  activeResponse,
  handleSetActiveResponse,
  className,
  requestId,
}) => {
  const dropdownRef = useRef<DropdownHandle>(null);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const responses = useSelector(selectActiveRequestResponses);
  const activeRequest = useSelector(selectActiveRequest);
  const requestVersions = useSelector(selectRequestVersions);
  const now = new Date();
  const categories: Record<string, Response[]> = {
    minutes: [],
    hours: [],
    today: [],
    week: [],
    other: [],
  };

  const handleDeleteResponses = useCallback(async () => {
    const environmentId = activeEnvironment ? activeEnvironment._id : null;
    await models.response.removeForRequest(requestId, environmentId);

    if (activeRequest && activeRequest._id === requestId) {
      handleSetActiveResponse(requestId, null);
    }
  }, [activeEnvironment, activeRequest, handleSetActiveResponse, requestId]);

  const handleDeleteResponse = useCallback(async () => {
    if (activeResponse) {
      await models.response.remove(activeResponse);
    }
    handleSetActiveResponse(requestId, null);
  }, [activeResponse, handleSetActiveResponse, requestId]);

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

  const renderResponseRow = (response: Response) => {
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
        <SizeTag
          bytesRead={response.bytesRead}
          bytesContent={response.bytesContent}
          small
          tooltipDelay={1000}
        />
        {!response.requestVersionId ?
          <i
            className="icon fa fa-info-circle"
            title={'Request will not be restored with this response because it was created before this ability was added'}
          />
          : null}
      </DropdownItem>
    );
  };

  const handleKeydown = useCallback((event: KeyboardEvent) => {
    executeHotKey(event, hotKeyRefs.REQUEST_TOGGLE_HISTORY, () => dropdownRef.current?.toggle(true));
  }, []);
  const environmentName = activeEnvironment ? activeEnvironment.name : 'Base';
  const isLatestResponseActive = !responses.length || activeResponse._id === responses[0]._id;
  return (
    <KeydownBinder onKeydown={handleKeydown}>
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
        <DropdownItem buttonClass={PromptButton} addIcon onClick={handleDeleteResponse}>
          <i className="fa fa-trash-o" />
          Delete Current Response
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton} addIcon onClick={handleDeleteResponses}>
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
    </KeydownBinder>
  );
};
