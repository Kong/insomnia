// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import moment from 'moment';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import StatusTag from '../tags/status-tag';
import URLTag from '../tags/url-tag';
import PromptButton from '../base/prompt-button';
import KeydownBinder from '../keydown-binder';
import TimeTag from '../tags/time-tag';
import SizeTag from '../tags/size-tag';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { hotKeyRefs } from '../../../common/hotkeys';
import TimeFromNow from '../time-from-now';
import type { Response } from '../../../models/response';
import type { RequestVersion } from '../../../models/request-version';
import { decompressObject } from '../../../common/misc';
import type { Environment } from '../../../models/environment';

type Props = {
  handleSetActiveResponse: Response => Promise<void>,
  handleDeleteResponses: (requestId: string, environmentId: string | null) => Promise<void>,
  handleDeleteResponse: Response => Promise<void>,
  requestId: string,
  responses: Array<Response>,
  requestVersions: Array<RequestVersion>,
  activeResponse: Response,
  activeEnvironment: ?Environment,
};

@autobind
class ResponseHistoryDropdown extends React.PureComponent<Props> {
  _dropdown: ?Dropdown;

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

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

  _handleKeydown(e: KeyboardEvent) {
    executeHotKey(e, hotKeyRefs.REQUEST_TOGGLE_HISTORY, () => {
      this._dropdown && this._dropdown.toggle(true);
    });
  }

  renderDropdownItem(response: Response, i: number) {
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
        value={i === 0 ? null : response}
        onClick={this._handleSetActiveResponse}>
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

  renderPastResponses(responses: Array<Response>) {
    const now = moment();
    // Four arrays for four time groups
    const categories = { minutes: [], hours: [], today: [], week: [], other: [] };
    responses.forEach(r => {
      const resTime = moment(r.created);
      if (now.diff(resTime, 'minutes') < 5) {
        // Five minutes ago
        categories.minutes.push(r);
      } else if (now.diff(resTime, 'hours') < 2) {
        // Two hours ago
        categories.hours.push(r);
      } else if (now.isSame(resTime, 'day')) {
        // Today
        categories.today.push(r);
      } else if (now.isSame(resTime, 'week')) {
        // This week
        categories.week.push(r);
      } else {
        // Older
        categories.other.push(r);
      }
    });

    return (
      <React.Fragment>
        <DropdownDivider>5 Minutes Ago</DropdownDivider>
        {categories.minutes.map(this.renderDropdownItem)}
        <DropdownDivider>2 Hours Ago</DropdownDivider>
        {categories.hours.map(this.renderDropdownItem)}
        <DropdownDivider>Today</DropdownDivider>
        {categories.today.map(this.renderDropdownItem)}
        <DropdownDivider>This Week</DropdownDivider>
        {categories.week.map(this.renderDropdownItem)}
        <DropdownDivider>Older Than This Week</DropdownDivider>
        {categories.other.map(this.renderDropdownItem)}
      </React.Fragment>
    );
  }

  render() {
    const {
      activeResponse, // eslint-disable-line no-unused-vars
      handleSetActiveResponse, // eslint-disable-line no-unused-vars
      handleDeleteResponses, // eslint-disable-line no-unused-vars
      handleDeleteResponse, // eslint-disable-line no-unused-vars
      responses,
      activeEnvironment,
      ...extraProps
    } = this.props;

    const environmentName = activeEnvironment ? activeEnvironment.name : 'Base';

    const isLatestResponseActive = !responses.length || activeResponse._id === responses[0]._id;

    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <Dropdown
          ref={this._setDropdownRef}
          key={activeResponse ? activeResponse._id : 'n/a'}
          {...(extraProps: Object)}>
          <DropdownButton className="btn btn--super-compact tall" title="Response history">
            {activeResponse && <TimeFromNow timestamp={activeResponse.created} capitalize />}
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

export default ResponseHistoryDropdown;
