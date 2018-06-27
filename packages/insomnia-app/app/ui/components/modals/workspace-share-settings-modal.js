import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem
} from '../base/dropdown';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import * as session from '../../../sync/session';
import * as sync from '../../../sync/index';
import { showPrompt } from './index';
import PromptButton from '../base/prompt-button';

@autobind
class WorkspaceShareSettingsModal extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {};
  }

  _handleSubmit(e) {
    e.preventDefault();
  }

  _handleClose() {
    this.hide();
  }

  _setModalRef(n) {
    this.modal = n;
  }

  async _handleUnshare() {
    if (!session.isLoggedIn()) {
      return;
    }

    const { resourceGroup } = this.state;

    this._resetState({ loading: true });

    try {
      await session.unshareWithAllTeams(resourceGroup.id);
      await this._load();
    } catch (err) {
      console.warn('Failed to unshare workspace', err);
      this._resetState({ error: err.message, loading: false });
    }
  }

  _handleShareWithTeam(team) {
    showPrompt({
      title: 'Share Workspace',
      label: 'Confirm password to share workspace',
      placeholder: '•••••••••••••••••',
      submitName: 'Share with Team',
      inputType: 'password',
      onComplete: async passphrase => {
        const { resourceGroup } = this.state;
        this._resetState({ loading: true });

        try {
          await session.shareWithTeam(resourceGroup.id, team.id, passphrase);
          await this._load();
        } catch (err) {
          this._resetState({ error: err.message, loading: false });
        }
      }
    });
  }

  async _load() {
    if (!session.isLoggedIn()) {
      this._resetState({});
      return;
    }

    const { workspace } = this.props;
    const resource = await sync.getOrCreateResourceForDoc(workspace);

    const teams = await session.listTeams();

    try {
      const resourceGroup = await sync.fetchResourceGroup(
        resource.resourceGroupId,
        true
      );
      this.setState({ teams, resourceGroup, loading: false, error: '' });
    } catch (err) {
      console.warn('Failed to fetch ResourceGroup', err);
      this.setState({
        error: 'No sync info found. Please try again.',
        loading: false
      });
    }
  }

  _resetState(patch = {}) {
    this.setState(
      Object.assign(
        {
          teams: [],
          resourceGroup: null,
          error: '',
          loading: false
        },
        patch
      )
    );
  }

  async show() {
    this._resetState();
    this.modal.show();

    // This takes a while, so do it after show()
    await this._load();
  }

  hide() {
    this.modal.hide();
  }

  componentWillMount() {
    this._resetState();
  }

  render() {
    const { teams, resourceGroup, error, loading } = this.state;
    const { workspace } = this.props;
    return (
      <form onSubmit={this._handleSubmit}>
        <Modal ref={this._setModalRef}>
          <ModalHeader key="header">Share Workspace</ModalHeader>
          <ModalBody key="body" className="pad text-center" noScroll>
            <p>
              Share <strong>{workspace.name}</strong> to automatically sync your
              API workspace with your team members.
            </p>
            <div className="form-control pad">
              {error ? <div className="danger">Oops: {error}</div> : null}
              <Dropdown outline>
                <DropdownDivider>Teams</DropdownDivider>
                {!loading ? (
                  resourceGroup && resourceGroup.teamId ? (
                    <DropdownButton className="btn btn--clicky">
                      <i className="fa fa-users" /> Shared with{' '}
                      <strong>{resourceGroup.teamName}</strong>{' '}
                      <i className="fa fa-caret-down" />
                    </DropdownButton>
                  ) : (
                    <DropdownButton className="btn btn--clicky">
                      <i className="fa fa-lock" /> Private{' '}
                      <i className="fa fa-caret-down" />
                    </DropdownButton>
                  )
                ) : (
                  <DropdownButton className="btn btn--clicky">
                    <i className="fa fa-spin fa-refresh" /> Loading...{' '}
                    <i className="fa fa-caret-down" />
                  </DropdownButton>
                )}
                {teams.map(team => (
                  <DropdownItem
                    key={team.id}
                    value={team}
                    onClick={this._handleShareWithTeam}>
                    <i className="fa fa-users" /> Share with{' '}
                    <strong>{team.name}</strong>
                  </DropdownItem>
                ))}
                {teams.length === 0 && (
                  <DropdownItem disabled onClick={this._handleShareWithTeam}>
                    <i className="fa fa-warning" /> You have no teams
                  </DropdownItem>
                )}
                <DropdownDivider>Other</DropdownDivider>
                <DropdownItem
                  addIcon
                  buttonClass={PromptButton}
                  confirmMessage="Really make private?"
                  onClick={this._handleUnshare}>
                  <i className="fa fa-lock" /> Private
                </DropdownItem>
              </Dropdown>
              &nbsp;&nbsp;
              {session.isLoggedIn() ? (
                <Link
                  button
                  className="btn btn--super-compact inline-block"
                  href="https://insomnia.rest/app/teams/">
                  Manage Teams
                </Link>
              ) : (
                <Link
                  button
                  className="btn btn--super-compact inline-block"
                  href="https://insomnia.rest/teams/">
                  Manage Teams
                </Link>
              )}
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
  workspace: PropTypes.object.isRequired
};

export default WorkspaceShareSettingsModal;
