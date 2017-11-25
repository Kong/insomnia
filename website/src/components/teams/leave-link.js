import React, {Component, PropTypes} from 'react';
import * as session from '../../session';
import {trackEvent} from '../../analytics';

class LeaveTeamLink extends Component {
  state = {
    loading: false,
  };

  _handleClick = async e => {
    e.preventDefault();

    const {teamName, teamId, onLeave} = this.props;

    if (!confirm(`Are you sure you want to leave ${teamName}?`)) {
      return;
    }

    this.setState({loading: true});

    try {
      await session.leaveTeam(teamId);
      await onLeave();
      trackEvent('Teams', 'Leave Success');
    } catch (err) {
      alert(`Failed to leave team: ${err.message}`);
      this.setState({loading: false});
      trackEvent('Teams', 'Leave Error');
    }
  };

  render () {
    const {children, className} = this.props;
    const {loading} = this.state;
    return (
      <a href="#" onClick={this._handleClick} className={className}>
        {loading ? 'leaving...' : children}
      </a>
    );
  }
}

LeaveTeamLink.propTypes = {
  onLeave: PropTypes.func.isRequired,
  teamId: PropTypes.string.isRequired,
  teamName: PropTypes.string.isRequired,
};

export default LeaveTeamLink;
