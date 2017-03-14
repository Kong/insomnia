import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import SizeTag from '../tags/size-tag';
import StatusTag from '../tags/status-tag';
import TimeTag from '../tags/time-tag';
import * as models from '../../../models/index';
import PromptButton from '../base/prompt-button';
import {trackEvent} from '../../../analytics/index';

@autobind
class ResponseHistoryDropdown extends PureComponent {
  constructor (props) {
    super(props);
    this._interval = null;
    this.state = {
      responses: []
    };
  }

  _handleDeleteResponses () {
    trackEvent('History', 'Delete Responses');
    this.props.handleDeleteResponses(this.props.requestId);
  }

  _handleSetActiveResponse (responseId) {
    trackEvent('History', 'Activate Response');
    this.props.handleSetActiveResponse(responseId);
  }

  _load (requestId) {
    clearTimeout(this._interval);
    this._interval = setTimeout(async () => {
      const responses = await models.response.findRecentForRequest(requestId);

      // NOTE: this is bad practice, but I can't figure out a better way.
      // This component may not be mounted if the user switches to a request that
      // doesn't have a response
      if (this._unmounted) {
        return;
      }

      if (this.state.responses.length !== responses.length) {
        this.setState({responses});
      }
    }, 500);
  }

  componentWillUnmount () {
    clearTimeout(this._interval);
  }

  componentWillReceiveProps (nextProps) {
    this._load(nextProps.requestId);
  }

  componentDidMount () {
    this._load(this.props.requestId);
  }

  renderDropdownItem (response, i) {
    const {activeResponseId} = this.props;
    const active = response._id === activeResponseId;
    return (
      <DropdownItem key={response._id}
                    disabled={active}
                    value={i === 0 ? null : response._id}
                    onClick={this._handleSetActiveResponse}>
        {active ? <i className="fa fa-thumb-tack"/> : <i className="fa fa-empty"/>}
        {' '}
        <StatusTag small
                   statusCode={response.statusCode}
                   statusMessage={response.statusMessage || 'Error'}/>
        <TimeTag milliseconds={response.elapsedTime} small/>
        <SizeTag bytes={response.bytesRead} small/>
      </DropdownItem>
    );
  }

  render () {
    const {
      activeResponseId, // eslint-disable-line no-unused-vars
      handleSetActiveResponse, // eslint-disable-line no-unused-vars
      handleDeleteResponses, // eslint-disable-line no-unused-vars
      isLatestResponseActive,
      ...extraProps
    } = this.props;
    const {responses} = this.state;

    return (
      <Dropdown {...extraProps}>
        <DropdownButton className="btn btn--super-compact tall">
          {isLatestResponseActive
            ? <i className="fa fa-history"/>
            : <i className="fa fa-thumb-tack"/>}
        </DropdownButton>
        <DropdownDivider>Response History</DropdownDivider>
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
  onChange: PropTypes.func.isRequired,
  requestId: PropTypes.string.isRequired,
  activeResponseId: PropTypes.string.isRequired,
  isLatestResponseActive: PropTypes.bool.isRequired
};

export default ResponseHistoryDropdown;
