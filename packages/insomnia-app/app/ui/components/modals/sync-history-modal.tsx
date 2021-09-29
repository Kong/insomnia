import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent } from 'react';

import * as session from '../../../account/session';
import { AUTOBIND_CFG } from '../../../common/constants';
import type { Workspace } from '../../../models/workspace';
import type { Snapshot } from '../../../sync/types';
import { VCS } from '../../../sync/vcs/vcs';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { TimeFromNow } from '../time-from-now';
import { Tooltip } from '../tooltip';

interface Props {
  workspace: Workspace;
  vcs: VCS;
}

interface State {
  branch: string;
  history: Snapshot[];
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class SyncHistoryModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  handleRollback: (arg0: Snapshot) => Promise<void>;

  state: State = {
    branch: '',
    history: [],
  };

  _setModalRef(m: Modal) {
    this.modal = m;
  }

  async _handleClickRollback(snapshot: Snapshot) {
    await this.handleRollback(snapshot);
    await this.refreshState();
  }

  async refreshState(newState?: Record<string, any>) {
    const { vcs } = this.props;
    const branch = await vcs.getBranch();
    const history = await vcs.getHistory();
    this.setState({
      branch,
      history: history.sort((a, b) => (a.created < b.created ? 1 : -1)),
      ...newState,
    });
  }

  hide() {
    this.modal?.hide();
  }

  async show(options: { handleRollback: (arg0: Snapshot) => Promise<void> }) {
    this.modal?.show();
    this.handleRollback = options.handleRollback;
    await this.refreshState();
  }

  static renderAuthorName(snapshot: Snapshot) {
    let name = '';
    let email = '';

    if (snapshot.authorAccount) {
      const { firstName, lastName } = snapshot.authorAccount;
      name += `${firstName} ${lastName}`;
      email = snapshot.authorAccount.email;
    }

    if (snapshot.author === session.getAccountId()) {
      name += ' (you)';
    }

    if (name) {
      return (
        <Fragment>
          {name}{' '}
          <HelpTooltip
            info
            // @ts-expect-error -- TSCONVERSION
            delay={500}
          >
            {email}
          </HelpTooltip>
        </Fragment>
      );
    } else {
      return '--';
    }
  }

  render() {
    const { branch, history } = this.state;
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>
          Branch History: <i>{branch}</i>
        </ModalHeader>
        <ModalBody className="wide pad">
          <table className="table--fancy table--striped">
            <thead>
              <tr>
                <th className="text-left">Message</th>
                <th className="text-left">When</th>
                <th className="text-left">Author</th>
                <th className="text-right">Objects</th>
                <th className="text-right">
                  Restore
                  <HelpTooltip>
                    This will revert the workspace to that state stored in the snapshot
                  </HelpTooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map(snapshot => (
                <tr key={snapshot.id}>
                  <td>
                    <Tooltip message={snapshot.id} selectable wide delay={500}>
                      {snapshot.name}
                    </Tooltip>
                  </td>
                  <td>
                    <TimeFromNow
                      className="no-wrap"
                      timestamp={snapshot.created}
                      intervalSeconds={30}
                    />
                  </td>
                  <td className="text-left">{SyncHistoryModal.renderAuthorName(snapshot)}</td>
                  <td className="text-right">{snapshot.state.length}</td>
                  <td className="text-right">
                    <PromptButton
                      className="btn btn--micro btn--outlined"
                      onClick={() => this._handleClickRollback(snapshot)}
                    >
                      Restore
                    </PromptButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModalBody>
      </Modal>
    );
  }
}
