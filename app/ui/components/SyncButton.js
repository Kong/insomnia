import React, {Component, PropTypes} from 'react';
import SyncModal from './modals/SyncModal';
import {getModal} from './modals/index';
import * as syncStorage from '../../backend/sync/storage';
import * as session from '../../backend/sync/session';
import SignupModal from './modals/SignupModal';

const STATE_OK = 'synced';
const STATE_AHEAD = 'pending';
const STATE_OFF = 'paused';

class SyncButton extends Component {
  constructor (props) {
    super(props);
    this.state = {
      state: STATE_OK,
      loggedIn: false
    }
  }

  async _updateState () {
    const {workspaceId} = this.props;
    const resource = await syncStorage.getResourceById(workspaceId);
    const resourceGroupId = resource ? resource.resourceGroupId : null;
    const config = await syncStorage.getConfig(resourceGroupId);
    const dirtyDocs = await syncStorage.findActiveDirtyResourcesForResourceGroup(resourceGroupId);
    let state;
    if (config && config.syncMode === syncStorage.SYNC_MODE_OFF) {
      state = STATE_OFF;
    } else if (config && dirtyDocs.length > 0) {
      state = STATE_AHEAD;
    } else if (!config) {
      state = STATE_OFF;
    } else {
      state = STATE_OK;
    }

    const loggedIn = session.isLoggedIn();
    const newState = Object.assign({}, this.state, {state, loggedIn});

    // Only reset the state if something has changed
    for (const k of Object.keys(newState)) {
      if (newState[k] !== this.state[k]) {
        this.setState(newState);
        break;
      }
    }
  }

  componentDidMount () {
    this._interval = setInterval(() => this._updateState(), 2000);
    this._updateState();
  }

  componentWillUnmount () {
    clearInterval(this._interval);
  }

  render () {
    if (session.isLoggedIn()) {
      return (
        <button className="btn btn--super-compact btn--outlined wide ellipsis"
                onClick={e => getModal(SyncModal).show()}>
          Sync
          {this.state.state ? <span>&nbsp;({this.state.state})</span> : null}
        </button>
      )
    } else {
      return (
        <button className="btn btn--super-compact btn--outlined wide"
                onClick={e => getModal(SignupModal).show()}>
          Login to Cloud Sync
        </button>
      )
    }
  }
}

SyncButton.propTypes = {
  workspaceId: PropTypes.string.isRequired
};

export default SyncButton;
