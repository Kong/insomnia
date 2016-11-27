import React, {PropTypes, Component} from 'react';
import {Dropdown, DropdownButton, DropdownItem} from '../base/dropdown';
import * as models from '../../../models/index';

class ResponseHistoryDropdown extends Component {
  state = {
    responses: []
  };

  componentWillReceiveProps (nextProps) {
    this._load(nextProps.requestId);
  }

  async _load (requestId) {
    const responses = await models.response.findRecentForRequest(requestId, 10);

    // NOTE: this is bad practice, but I can't figure out a better way.
    // This component may not be mounted if the user switches to a request that
    // doesn't have a response
    if (!this._unmounted) {
      this.setState({responses});
    }
  }

  componentWillUnmount () {
    this._unmounted = true;
  }

  componentDidMount () {
    this._unmounted = false;
    this._load(this.props.requestId);
  }

  render () {
    const {...extraProps} = this.props;
    const {responses} = this.state;

    return (
      <Dropdown {...extraProps}>
        <DropdownButton className="btn btn--super-compact tall">
          <i className="fa fa-clock-o"></i>
        </DropdownButton>
        {responses.map(r => (
          <DropdownItem key={r._id}>
            {r.statusCode}
          </DropdownItem>
        ))}
      </Dropdown>
    )
  }
}

ResponseHistoryDropdown.propTypes = {
  onChange: PropTypes.func.isRequired,
  requestId: PropTypes.string.isRequired,
};

export default ResponseHistoryDropdown;
