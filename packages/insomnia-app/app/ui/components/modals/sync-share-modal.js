// @flow

import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import PromptButton from '../base/prompt-button';
import type { Workspace } from '../../../models/workspace';
import VCS from '../../../sync/vcs';
import { showModal } from './index';
import { strings } from '../../../common/strings';

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

@autoBindMethodsForReact(AUTOBIND_CFG)
class SyncShareModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

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
    const { vcs } = this.props;
    this.setState({ loading: true });

    try {
      if (team) {
        await vcs.shareWithTeam(team.id);
      } else {
        await vcs.unShareWithTeam();
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

  async show() {
    const { vcs } = this.props;
    this.setState({ loading: true });
    this.modal && this.modal.show();

    if (!vcs.hasProject()) {
      this.setState({
        error: `Please set up sync to be able to share the ${strings.collection.toLowerCase()}`,
        loading: false,
      });
      return;
    }

    let results;
    try {
      results = await Promise.all([vcs.teams(), vcs.projectTeams()]);
    } catch (err) {
      this.setState({ error: err.message, loading: false });
      return;
    }

    const [teams, projectTeams] = results;
    this.setState({
      teams,
      selectedTeam: projectTeams[0] || null,
      error: '',
      loading: false,
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
        <ModalHeader key="header">Share {strings.collection}</ModalHeader>
        <ModalBody key="body" className="pad text-center" noScroll>
          {error && <p className="notice error margin-bottom-sm no-margin-top">{error}</p>}
          <p>
            Collaborate on <strong>{workspace.name}</strong> with your team.
          </p>
          <div className="form-control pad">
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
              href="https://app.insomnia.rest/app/teams/">
              Manage Teams
            </Link>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

export const showSyncShareModal = () => showModal(SyncShareModal);

export default SyncShareModal;
