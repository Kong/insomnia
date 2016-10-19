import React, {Component, PropTypes} from 'react';
import SyncModal from './modals/SyncModal';
import {getModal} from './modals/index';
import * as syncStorage from '../../backend/sync/storage';
import * as session from '../../backend/sync/session';
import LoginModal from './modals/LoginModal';

class SyncButton extends Component {
  constructor (props) {
    super(props);
    this.state = {
      dirty: false,
      loggedIn: false
    }
  }

  _updateState () {
    const loggedIn = session.isLoggedIn();
    if (loggedIn !== this.state.loggedIn) {
      this.setState({loggedIn});
    }

    const dirty = syncStorage.findDirty().length > 0;
    if (dirty !== this.state.dirty) {
      this.setState({dirty});
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
          {this.state.dirty ? (
            <i className="fa fa-refresh fa-spin"></i>
          ) : null}
          Cloud Sync
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
