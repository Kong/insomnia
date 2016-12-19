import React, {Component, PropTypes} from 'react';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../sync/session';
import LoginModal from './LoginModal';
import {showModal} from './index';

class WorkspaceShareSettingsModal extends Component {
  state = {
    team: null
  };

  async _load () {
    if (!session.isLoggedIn()) {
      showModal(LoginModal);
    }

    const teams = await session.listTeams();
    console.log('TEAMS', teams);
    const accountId = session.getAccountId();
    const team = teams.find(t => t.ownerAccountId === accountId);
    this.setState({team});
  }

  _handleSubmit = e => {
    e.preventDefault();
    console.log('Submit');
  };

  _handleClose = () => this.hide();

  _setModalRef = m => {
    this.modal = m;
  };

  show () {
    this.modal.show();
    this._load();
  }

  render () {
    const {team} = this.state;

    return (
      <form onSubmit={this._handleSubmit}>
        <Modal ref={this._setModalRef}>
          <ModalHeader key="header">Share Workspace</ModalHeader>
          <ModalBody key="body" className="pad" noScroll={true}>
            <p>
              Enabling sync will automatically share your workspace with your entire team
            </p>
            <div className="text-center form-control pad">
              <Dropdown outline={true}>
                <DropdownDivider>Teams</DropdownDivider>
                <DropdownButton type="button" className="btn btn--clicky">
                  <i className="fa fa-lock"/> Private <i className="fa fa-caret-down"/>
                </DropdownButton>
                {team ? (
                  <DropdownItem>
                    <i className="fa fa-users"/> Share with <strong>{team.name}</strong>
                  </DropdownItem>
                ) : null}
                <DropdownDivider>Other</DropdownDivider>
                <DropdownItem>
                  <i className="fa fa-lock"/> Private
                </DropdownItem>
              </Dropdown>
              &nbsp;&nbsp;
              <Link button={true}
                    className="btn btn--super-compact inline-block"
                    href="https://insomnia.rest/app/teams/">
                Manage Teams
              </Link>
            </div>
          </ModalBody>
          <ModalFooter key="footer">
            <button type="button" className="btn" onClick={this._handleClose}>
              Done
            </button>
          </ModalFooter>
        </Modal>
      </form>
    );
  }
}

WorkspaceShareSettingsModal.propTypes = {
  workspace: PropTypes.object.isRequired,
};

export default WorkspaceShareSettingsModal;
