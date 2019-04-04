// @flow

import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import PromptButton from '../base/prompt-button';
import type { Workspace } from '../../../models/workspace';
import { VCS } from 'insomnia-sync';

type Props = {
  workspace: Workspace,
  vcs: VCS,
};

type Team = { id: string, name: string };

type State = {
  loading: boolean,
  selectedTeam: null | Team,
  teams: Array<Team>,
  error: string,
};

@autobind
class SyncShareModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  handleShare: (team: Team) => Promise<void>;
  handleUnShare: () => Promise<void>;

  constructor(props: Props) {
    super(props);
    this.state = {
      selectedTeam: null,
      teams: [],
      error: '',
      loading: false,
    };
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  async _handleChangeTeam(team: Team) {
    this.setState({ loading: true });

    try {
      if (team && this.handleShare) {
        await this.handleShare(team);
      } else if (!team && this.handleUnShare) {
        await this.handleUnShare();
      }
    } catch (err) {
      this.setState({
        error: err.message,
        loading: false,
      });
    }

    this.setState({
      selectedTeam: team,
      error: '',
      loading: false,
    });
  }

  async show(options: {
    teams: Array<Team>,
    team: Team | null,
    handleShare: (team: Team) => Promise<void>,
    handleUnShare: () => Promise<void>,
  }) {
    this.modal && this.modal.show();

    this.handleShare = options.handleShare;
    this.handleUnShare = options.handleUnShare;

    this.setState({
      teams: options.teams,
      selectedTeam: options.team,
      error: '',
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  render() {
    const { teams, error, selectedTeam, loading } = this.state;
    const { workspace } = this.props;
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader key="header">Share Workspace</ModalHeader>
        <ModalBody key="body" className="pad text-center" noScroll>
          <p>
            Share <strong>{workspace.name}</strong> with your team members.
          </p>
          <div className="form-control pad">
            {error ? <div className="danger">Oops: {error}</div> : null}
            <Dropdown outline>
              <DropdownDivider>Teams</DropdownDivider>
              {selectedTeam ? (
                <DropdownButton className="btn btn--clicky" disabled={loading}>
                  {loading ? (
                    <i className="fa fa-refresh fa-spin" />
                  ) : (
                    <i className="fa fa-users" />
                  )}{' '}
                  Shared with <strong>{selectedTeam.name}</strong>{' '}
                  <i className="fa fa-caret-down" />
                </DropdownButton>
              ) : (
                <DropdownButton className="btn btn--clicky" disabled={loading}>
                  {loading ? (
                    <i className="fa fa-refresh fa-spin" />
                  ) : (
                    <i className="fa fa-users" />
                  )}{' '}
                  Private <i className="fa fa-caret-down" />
                </DropdownButton>
              )}
              {teams.map(team => (
                <DropdownItem key={team.id} value={team} onClick={this._handleChangeTeam}>
                  <i className="fa fa-users" /> Share with <strong>{team.name}</strong>
                </DropdownItem>
              ))}
              {teams.length === 0 && (
                <DropdownItem disabled>
                  <i className="fa fa-warning" /> You have no teams
                </DropdownItem>
              )}
              <DropdownDivider>Other</DropdownDivider>
              <DropdownItem
                addIcon
                buttonClass={PromptButton}
                confirmMessage="Really make private?"
                value={null}
                onClick={this._handleChangeTeam}>
                <i className="fa fa-lock" /> Private
              </DropdownItem>
            </Dropdown>
            &nbsp;&nbsp;
            <Link
              button
              className="btn btn--super-compact inline-block"
              href="https://insomnia.rest/app/teams/">
              Manage Teams
            </Link>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

export default SyncShareModal;
