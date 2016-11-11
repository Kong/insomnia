import React, {Component, PropTypes} from 'react';
import {Dropdown, DropdownItem, DropdownButton} from './base/dropdown';
import {showModal} from './modals/index';
import * as syncStorage from '../../sync/storage';
import * as session from '../../sync/session';
import SignupModal from './modals/SignupModal';

const STATE_OK = 'synced';
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
    const {workspaceId} = this.props;
    const resource = await syncStorage.getResourceByDocId(workspaceId);
    const resourceGroupId = resource ? resource.resourceGroupId : null;
    const isDirty = await syncStorage.hasDirtyResourcesForResourceGroup(resourceGroupId);
    let state;
    if (isDirty) {
      state = STATE_AHEAD;
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
    const {workspaceId} = this.props;
    const {state: buttonState} = this.state;
    if (session.isLoggedIn()) {
      return (
        <Dropdown wide={true} className="wide">
          <DropdownButton className="btn btn--super-duper-compact btn--outlined wide ellipsis">
            Sync {buttonState ? `(${buttonState})` : null}
          </DropdownButton>
          <DropdownItem>
            Hello A
          </DropdownItem>
          <DropdownItem>
            Hello B
          </DropdownItem>
        </Dropdown>
      );
    } else {
      return (
        <button className="btn btn--super-duper-compact btn--outlined wide"
                onClick={e => showModal(SignupModal)}>
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
