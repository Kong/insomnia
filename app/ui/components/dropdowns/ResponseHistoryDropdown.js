import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import SizeTag from '../tags/SizeTag';
import StatusTag from '../tags/StatusTag';
import TimeTag from '../tags/TimeTag';
import * as models from '../../../models/index';
import PromptButton from '../base/PromptButton';
import {trackEvent} from '../../../analytics/index';
import * as misc from '../../../common/misc';

@autobind
class ResponseHistoryDropdown extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      responses: [],
    };

    this._load = misc.debounce(this._load);
  }

  _handleDeleteResponses () {
    trackEvent('History', 'Delete Responses');
    this.props.handleDeleteResponses(this.props.requestId);
  }

  _handleSetActiveResponse (responseId) {
    trackEvent('History', 'Activate Response');
    this.props.handleSetActiveResponse(responseId);
  }

  async _load (requestId) {
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
  }

  componentWillUnmount () {
    this._unmounted = true;
  }

  componentWillReceiveProps (nextProps) {
    this._load(nextProps.requestId);
  }

  componentDidMount () {
    this._unmounted = false;
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
        {" "}
        <StatusTag small
                   statusCode={response.statusCode}
                   statusMessage={response.statusMessage || 'Error'}/>
        <TimeTag milliseconds={response.elapsedTime} small/>
        <SizeTag bytes={response.bytesRead} small/>
      </DropdownItem>
    )
  }

  render () {
    const {
      activeResponseId, // Don't want this in ...extraProps
      handleSetActiveResponse, // Don't want this in ...extraProps
      handleDeleteResponses, // Don't want this in ...extraProps
      isLatestResponseActive,
      ...extraProps
    } = this.props;
    const {responses} = this.state;

    return (
      <Dropdown {...extraProps}>
        <DropdownButton className="btn btn--super-compact tall">
          {isLatestResponseActive ?
            <i className="fa fa-history"/> :
            <i className="fa fa-thumb-tack"/>}
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
    )
  }
}

ResponseHistoryDropdown.propTypes = {
  handleSetActiveResponse: PropTypes.func.isRequired,
  handleDeleteResponses: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  requestId: PropTypes.string.isRequired,
  activeResponseId: PropTypes.string.isRequired,
  isLatestResponseActive: PropTypes.bool.isRequired,
};

export default ResponseHistoryDropdown;
