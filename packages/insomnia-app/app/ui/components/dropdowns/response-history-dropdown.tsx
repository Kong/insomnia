import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { differenceInHours, differenceInMinutes, isThisWeek, isToday } from 'date-fns';
import React, { Fragment, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { decompressObject } from '../../../common/misc';
import type { Environment } from '../../../models/environment';
import type { RequestVersion } from '../../../models/request-version';
import type { Response } from '../../../models/response';
import { Dropdown } from '../base/dropdown/dropdown';
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
  handleSetActiveResponse: Function;
  handleDeleteResponses: Function;
  handleDeleteResponse: Function;
  requestId: string;
  responses: Response[];
  requestVersions: RequestVersion[];
  activeResponse: Response;
  activeEnvironment?: Environment | null;
  className?: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponseHistoryDropdown extends PureComponent<Props> {
  _dropdown: Dropdown | null = null;

  _handleDeleteResponses() {
    const { requestId, activeEnvironment } = this.props;
    const environmentId = activeEnvironment ? activeEnvironment._id : null;
    this.props.handleDeleteResponses(requestId, environmentId);
  }

  _handleDeleteResponse() {
    this.props.handleDeleteResponse(this.props.activeResponse);
  }

  _handleSetActiveResponse(response: Response) {
    this.props.handleSetActiveResponse(response);
  }

  _handleKeydown(event: KeyboardEvent) {
    executeHotKey(event, hotKeyRefs.REQUEST_TOGGLE_HISTORY, () => {
      this._dropdown?.toggle(true);
    });
  }

  renderDropdownItem(response: Response) {
    const { activeResponse, requestVersions } = this.props;
    const activeResponseId = activeResponse ? activeResponse._id : 'n/a';
    const active = response._id === activeResponseId;
    const message =
      'Request will not be restored with this response because ' +
      'it was created before this ability was added';
    const requestVersion = requestVersions.find(v => v._id === response.requestVersionId);
    const request = requestVersion ? decompressObject(requestVersion.compressedRequest) : null;
    return (
      <DropdownItem
        key={response._id}
        disabled={active}
        value={response}
        onClick={this._handleSetActiveResponse}
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
        {!response.requestVersionId && <i className="icon fa fa-info-circle" title={message} />}
      </DropdownItem>
    );
  }

  renderPastResponses(responses: Response[]) {
    const now = new Date();

    const categories: Record<string, Response[]> = {
      minutes: [],
      hours: [],
      today: [],
      week: [],
      other: [],
    };

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

    return (
      <Fragment>
        <DropdownDivider>Just Now</DropdownDivider>
        {categories.minutes.map(this.renderDropdownItem)}
        <DropdownDivider>Less Than Two Hours Ago</DropdownDivider>
        {categories.hours.map(this.renderDropdownItem)}
        <DropdownDivider>Today</DropdownDivider>
        {categories.today.map(this.renderDropdownItem)}
        <DropdownDivider>This Week</DropdownDivider>
        {categories.week.map(this.renderDropdownItem)}
        <DropdownDivider>Older Than This Week</DropdownDivider>
        {categories.other.map(this.renderDropdownItem)}
      </Fragment>
    );
  }

  render() {
    const {
      activeResponse,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      handleSetActiveResponse,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      handleDeleteResponses,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      handleDeleteResponse,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      responses,
      activeEnvironment,
      ...extraProps
    } = this.props;
    const environmentName = activeEnvironment ? activeEnvironment.name : 'Base';
    const isLatestResponseActive = !responses.length || activeResponse._id === responses[0]._id;
    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <Dropdown
          ref={ref => { this._dropdown = ref; }}
          key={activeResponse ? activeResponse._id : 'n/a'}
          {...extraProps}
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
          <DropdownItem buttonClass={PromptButton} addIcon onClick={this._handleDeleteResponse}>
            <i className="fa fa-trash-o" />
            Delete Current Response
          </DropdownItem>
          <DropdownItem buttonClass={PromptButton} addIcon onClick={this._handleDeleteResponses}>
            <i className="fa fa-trash-o" />
            Clear History
          </DropdownItem>
          {this.renderPastResponses(responses)}
        </Dropdown>
      </KeydownBinder>
    );
  }
}
