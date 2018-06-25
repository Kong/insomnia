import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem
} from '../base/dropdown';
import StatusTag from '../tags/status-tag';
import URLTag from '../tags/url-tag';
import PromptButton from '../base/prompt-button';
import KeydownBinder from '../keydown-binder';
import * as hotkeys from '../../../common/hotkeys';
import TimeTag from '../tags/time-tag';
import SizeTag from '../tags/size-tag';

@autobind
class ResponseHistoryDropdown extends PureComponent {
  _setDropdownRef(n) {
    this._dropdown = n;
  }

  _handleDeleteResponses() {
    this.props.handleDeleteResponses(this.props.requestId);
  }

  _handleDeleteResponse() {
    this.props.handleDeleteResponse(this.props.activeResponse);
  }

  _handleSetActiveResponse(response) {
    this.props.handleSetActiveResponse(response);
  }

  _handleKeydown(e) {
    hotkeys.executeHotKey(e, hotkeys.TOGGLE_HISTORY_DROPDOWN, () => {
      this._dropdown && this._dropdown.toggle(true);
    });
  }

  componentWillUnmount() {
    clearTimeout(this._interval);
  }

  renderDropdownItem(response, i) {
    const { activeResponse } = this.props;
    const activeResponseId = activeResponse ? activeResponse._id : 'n/a';
    const active = response._id === activeResponseId;
    const message =
      'Request will not be restored with this response because ' +
      'it was created before this ability was added';

    return (
      <DropdownItem
        key={response._id}
        disabled={active}
        value={i === 0 ? null : response}
        onClick={this._handleSetActiveResponse}>
        {active ? (
          <i className="fa fa-thumb-tack" />
        ) : (
          <i className="fa fa-empty" />
        )}{' '}
        <StatusTag
          small
          statusCode={response.statusCode}
          statusMessage={response.statusMessage || null}
        />
        <URLTag small url={response.url} />
        <TimeTag milliseconds={response.elapsedTime} small />
        <SizeTag
          bytesRead={response.bytesRead}
          bytesContent={response.bytesContent}
          small
        />
        {!response.requestVersionId && (
          <i className="icon fa fa-info-circle" title={message} />
        )}
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

    const isLatestResponseActive =
      !responses.length || activeResponse._id === responses[0]._id;

    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <Dropdown
          ref={this._setDropdownRef}
          key={activeResponse ? activeResponse._id : 'n/a'}
          {...extraProps}>
          <DropdownButton
            className="btn btn--super-compact tall"
            title="Response history">
            {!isLatestResponseActive ? (
              <i className="fa fa-thumb-tack" />
            ) : (
              <i className="fa fa-clock-o" />
            )}
            <i className="fa fa-caret-down" />
          </DropdownButton>
          <DropdownDivider>Response History</DropdownDivider>
          <DropdownItem
            buttonClass={PromptButton}
            addIcon
            onClick={this._handleDeleteResponse}>
            <i className="fa fa-trash-o" />
            Delete Current Response
          </DropdownItem>
          <DropdownItem
            buttonClass={PromptButton}
            addIcon
            onClick={this._handleDeleteResponses}>
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

ResponseHistoryDropdown.propTypes = {
  handleSetActiveResponse: PropTypes.func.isRequired,
  handleDeleteResponses: PropTypes.func.isRequired,
  handleDeleteResponse: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  requestId: PropTypes.string.isRequired,
  responses: PropTypes.arrayOf(PropTypes.object).isRequired,

  // Optional
  activeResponse: PropTypes.object
};

export default ResponseHistoryDropdown;
