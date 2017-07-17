import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownDivider, DropdownItem} from '../base/dropdown';
import SizeTag from '../tags/size-tag';
import StatusTag from '../tags/status-tag';
import TimeTag from '../tags/time-tag';
import PromptButton from '../base/prompt-button';
import {trackEvent} from '../../../analytics/index';

@autobind
class ResponseHistoryDropdown extends PureComponent {
  _handleDeleteResponses () {
    trackEvent('History', 'Delete Responses');
    this.props.handleDeleteResponses(this.props.requestId);
  }

  _handleDeleteResponse () {
    trackEvent('History', 'Delete Response');
    this.props.handleDeleteResponse(this.props.activeResponse);
  }

  _handleSetActiveResponse (response) {
    trackEvent('History', 'Activate Response');
    this.props.handleSetActiveResponse(response);
  }

  componentWillUnmount () {
    clearTimeout(this._interval);
  }

  renderDropdownItem (response, i) {
    const {activeResponse} = this.props;
    const activeResponseId = activeResponse ? activeResponse._id : 'n/a';
    const active = response._id === activeResponseId;
    const message = 'Request will not be restored with this response because ' +
      'it was created before this ability was added';

    return (
      <DropdownItem key={response._id}
                    disabled={active}
                    value={i === 0 ? null : response}
                    onClick={this._handleSetActiveResponse}>
        {active ? <i className="fa fa-thumb-tack"/> : <i className="fa fa-empty"/>}
        {' '}
        <StatusTag
          small
          statusCode={response.statusCode}
          statusMessage={response.statusMessage || null}
        />
        <TimeTag milliseconds={response.elapsedTime} small/>
        <SizeTag bytes={response.bytesRead} small/>
        {!response.requestVersionId && <i className="icon fa fa-info-circle" title={message}/>}
      </DropdownItem>
    );
  }

  render () {
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
      <Dropdown key={activeResponse ? activeResponse._id : 'n/a'} {...extraProps}>
        <DropdownButton className="btn btn--super-compact tall">
          {isLatestResponseActive
            ? <i className="fa fa-history"/>
            : <i className="fa fa-thumb-tack"/>}
        </DropdownButton>
        <DropdownDivider>Response History</DropdownDivider>
        <DropdownItem buttonClass={PromptButton}
                      addIcon
                      onClick={this._handleDeleteResponse}>
          <i className="fa fa-trash-o"/>
          Delete Current Response
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton}
                      addIcon
                      onClick={this._handleDeleteResponses}>
          <i className="fa fa-trash-o"/>
          Clear History
        </DropdownItem>
        <DropdownDivider>Past Responses</DropdownDivider>
        {responses.map(this.renderDropdownItem)}
      </Dropdown>
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
