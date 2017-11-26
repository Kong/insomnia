import React, {Component, PropTypes} from 'react';
import * as session from '../../session';
import {trackEvent} from '../../analytics';

class RemoveAccountLink extends Component {
  state = {
    loading: false
  };

  _handleClick = async e => {
    e.preventDefault();

    const {teamName, teamId, accountName, accountId, onRemove} = this.props;

    if (!confirm(`Are you sure you want to remove ${accountName} from ${teamName}?`)) {
      return;
    }

    this.setState({loading: true});

    try {
      await session.removeFromTeam(teamId, accountId);
      await onRemove();
      trackEvent('Teams', 'Remove Member Success');
    } catch (err) {
      alert(`Failed to remove from team: ${err.message}`);
      this.setState({loading: false});
      trackEvent('Teams', 'Remove Member Error');
    }
  };

  render () {
    const {children, className} = this.props;
    const {loading} = this.state;
    return (
      <a href="#" onClick={this._handleClick} className={className}>
        {loading ? 'removing...' : children}
      </a>
    );
  }
}

RemoveAccountLink.propTypes = {
  onRemove: PropTypes.func.isRequired,
  teamId: PropTypes.string.isRequired,
  teamName: PropTypes.string.isRequired,
  accountId: PropTypes.string.isRequired,
  accountName: PropTypes.string.isRequired,
};

export default RemoveAccountLink;
