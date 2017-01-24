import React, {Component, PropTypes} from 'react';
import {Dropdown, DropdownButton, DropdownItem, DropdownDivider} from '../base/dropdown';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../sync/session';
import * as sync from '../../../sync/index';
import LoginModal from './LoginModal';
import {showModal} from './index';
import PromptModal from './PromptModal';
import PromptButton from '../base/PromptButton';
import {trackEvent} from '../../../analytics/index';

class WorkspaceShareSettingsModal extends Component {
  state = {};

  _handleSubmit = e => e.preventDefault();
  _handleClose = () => this.hide();
  _setModalRef = m => this.modal = m;

  _handleUnshare = async () => {
    if (!session.isLoggedIn()) {
      return;
    }

    const {resourceGroup} = this.state;

    this._resetState({loading: true});

    try {
      await session.unshareWithAllTeams(resourceGroup.id);
      await this._load();
    } catch (err) {
      console.warn('Failed to unshare workspace', err);
      this._resetState({error: err.message, loading: false});
    }
  };

  _handleShareWithTeam = async team => {
    const passphrase = await showModal(PromptModal, {
      headerName: 'Share Workspace',
      label: 'Confirm password to share workspace',
      placeholder: '•••••••••••••••••',
      submitName: 'Share with Team',
      inputType: 'password',
    });

    const {resourceGroup} = this.state;
    this._resetState({loading: true});

    try {
      await session.shareWithTeam(resourceGroup.id, team.id, passphrase);
      await this._load();
    } catch (err) {
      this._resetState({error: err.message, loading: false});
    }
  };

  async _load () {
    if (!session.isLoggedIn()) {
      this._resetState({});
      return;
    }

    const {workspace} = this.props;
    const resource = await sync.getOrCreateResourceForDoc(workspace);

    const teams = await session.listTeams();

    try {
      const resourceGroup = await sync.fetchResourceGroup(resource.resourceGroupId, true);
      this.setState({teams, resourceGroup, loading: false, error: ''});
    } catch (err) {
      console.warn('Failed to fetch ResourceGroup', err);
      this.setState({error: 'No sync info found. Please try again.', loading: false});
      trackEvent('Sync', 'Error', 'Share Fetch Fail');
    }
  }

  _resetState (patch = {}) {
    this.setState(Object.assign({
      teams: [],
      resourceGroup: null,
      error: '',
      loading: false,
    }, patch));
  }

  async show () {
    this.modal.show();
    this._resetState();
    await this._load();
  }

  hide () {
    this.modal.hide();
  }

  componentWillMount () {
    this._resetState();
  }

  render () {
    const {teams, resourceGroup, error, loading} = this.state;
    const {workspace} = this.props;
    return (
      <form onSubmit={this._handleSubmit}>
        <Modal ref={this._setModalRef}>
          <ModalHeader key="header">Share Workspace</ModalHeader>
          <ModalBody key="body" className="pad text-center" noScroll={true}>
            <p>
              Share <strong>{workspace.name}</strong> to automatically sync
              your API workspace with your team members.
            </p>
            <div className="form-control pad">
              {error ? <div className="danger">Oops: {error}</div> : null}
              <Dropdown outline={true}>
                <DropdownDivider>Teams</DropdownDivider>
                {!loading ? (
                    resourceGroup && resourceGroup.teamId ? (
                        <DropdownButton className="btn btn--clicky">
                          <i className="fa fa-users"/> Shared with
                          {" "}
                          <strong>{resourceGroup.teamName}</strong>
                          {" "}
                          <i className="fa fa-caret-down"/>
                        </DropdownButton>
                      ) : (
                        <DropdownButton className="btn btn--clicky">
                          <i className="fa fa-lock"/> Private <i className="fa fa-caret-down"/>
                        </DropdownButton>
                      )
                  ) : (
                    <DropdownButton className="btn btn--clicky">
                      <i className="fa fa-spin fa-refresh"/> Loading...
                      {" "}
                      <i className="fa fa-caret-down"/>
                    </DropdownButton>
                  )}
                {teams.map(team => (
                  <DropdownItem key={team.id} value={team} onClick={this._handleShareWithTeam}>
                    <i className="fa fa-users"/> Share with <strong>{team.name}</strong>
                  </DropdownItem>
                ))}
                {teams.length === 0 ? (
                    <DropdownItem disabled={true} onClick={this._handleShareWithTeam}>
                      <i className="fa fa-warning"/> You have no teams
                    </DropdownItem>
                  ) : null}
                <DropdownDivider>Other</DropdownDivider>
                <DropdownItem buttonClass={PromptButton}
                              addIcon={true}
                              confirmMessage="Really make private?"
                              onClick={this._handleUnshare}>
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
