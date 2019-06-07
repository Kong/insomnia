// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
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

type Props = {
  handleSetActiveResponse: Response => Promise<void>,
  handleDeleteResponses: (requestId: string) => Promise<void>,
  handleDeleteResponse: Response => Promise<void>,
  requestId: string,
  responses: Array<Response>,
  requestVersions: Array<RequestVersion>,
  activeResponse: Response,
};

@autobind
class ResponseHistoryDropdown extends React.PureComponent<Props> {
  _dropdown: ?Dropdown;

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

  _handleDeleteResponses() {
    this.props.handleDeleteResponses(this.props.requestId);
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
        />
        <URLTag small url={response.url} method={request ? request.method : ''} />
        <TimeTag milliseconds={response.elapsedTime} small />
        <SizeTag bytesRead={response.bytesRead} bytesContent={response.bytesContent} small />
        {!response.requestVersionId && <i className="icon fa fa-info-circle" title={message} />}
      </DropdownItem>
    );
  }

  render() {
    const {
      activeResponse, // eslint-disable-line no-unused-vars
      handleSetActiveResponse, // eslint-disable-line no-unused-vars
      handleDeleteResponses, // eslint-disable-line no-unused-vars
      handleDeleteResponse, // eslint-disable-line no-unused-vars
      responses,
      ...extraProps
    } = this.props;

    const isLatestResponseActive = !responses.length || activeResponse._id === responses[0]._id;

    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <Dropdown
          ref={this._setDropdownRef}
          key={activeResponse ? activeResponse._id : 'n/a'}
          {...extraProps}>
          <DropdownButton className="btn btn--super-compact tall" title="Response history">
            {activeResponse && <TimeFromNow timestamp={activeResponse.created} capitalize />}
            {!isLatestResponseActive ? (
              <i className="fa fa-thumb-tack space-left" />
            ) : (
              <i className="fa fa-caret-down space-left" />
            )}
          </DropdownButton>
          <DropdownDivider>Response History</DropdownDivider>
          <DropdownItem buttonClass={PromptButton} addIcon onClick={this._handleDeleteResponse}>
            <i className="fa fa-trash-o" />
            Delete Current Response
          </DropdownItem>
          <DropdownItem buttonClass={PromptButton} addIcon onClick={this._handleDeleteResponses}>
            <i className="fa fa-trash-o" />
            Clear History
          </DropdownItem>
          <DropdownDivider>Past Responses</DropdownDivider>
          {responses.map(this.renderDropdownItem)}
        </Dropdown>
      </KeydownBinder>
    );
  }
}

export default ResponseHistoryDropdown;
