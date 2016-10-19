import React, {Component, PropTypes} from 'react';
import SyncModal from './modals/SyncModal';
import {getModal} from './modals/index';
import * as syncStorage from '../../backend/sync/storage';
import * as session from '../../backend/sync/session';
import LoginModal from './modals/LoginModal';

const STATE_OK = 'synced';
const STATE_BEHIND = 'behind';
const STATE_AHEAD = 'dirty';

class SyncButton extends Component {
  constructor (props) {
    super(props);
    this.state = {
      state: STATE_OK,
      loggedIn: false
    }
  }

  async _updateState () {
    const dirtyDocs = await syncStorage.findDirty();
    const newState = Object.assign({}, this.state, {
      state: dirtyDocs.length > 0 ? STATE_AHEAD : STATE_OK,
      loggedIn: session.isLoggedIn(),
    });

    // Only reset the state if something has changed
    for (const k of Object.keys(newState)) {
      if (newState[k] !== this.state[k]) {
        this.setState(newState);
        break;
      }
    }
  }

  componentDidMount () {
    setInterval(() => this._updateState(), 1000);
    this._updateState();
  }

  render () {
    if (session.isLoggedIn()) {
      return (
        <button className="btn btn--super-compact btn--outlined wide"
                onClick={e => getModal(SyncModal).show()}>
          Cloud Sync
          {this.state.state ? <span>&nbsp;({this.state.state})</span> : null}
        </button>
      )
    } else {
      return (
        <button className="btn btn--super-compact btn--outlined wide"
                onClick={e => getModal(LoginModal).show()}>
          Login to Cloud Sync
        </button>
      )
    }
  }
}

SyncButton.propTypes = {};

export default SyncButton;
