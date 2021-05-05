import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { GitVCS, GitLogEntry } from '../../../sync/git/git-vcs';
import ModalFooter from '../base/modal-footer';
import Tooltip from '../tooltip';
import TimeFromNow from '../time-from-now';

interface Props {
  vcs: GitVCS;
}

interface State {
  logs: GitLogEntry[];
  branch: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class GitLogModal extends PureComponent<Props, State> {
  modal: Modal | null = null;

  state: State = {
    logs: [],
    branch: '??',
  }

  _setModalRef(ref: Modal) {
    this.modal = ref;
  }

  async show() {
    const { vcs } = this.props;
    const logs = await vcs.log();
    const branch = await vcs.getBranch();
    this.setState({
      logs,
      branch,
    });
    this.modal && this.modal.show();
  }

  hide() {
    this.modal && this.modal.hide();
  }

  renderLogEntryRow(entry: GitLogEntry) {
    const {
      commit: { author, message },
      oid,
    } = entry;
    return (
      <tr key={oid}>
        <td>{message}</td>
        <td>
          <TimeFromNow
            className="no-wrap"
            timestamp={author.timestamp * 1000}
            intervalSeconds={30}
          />
        </td>
        <td>
          <Tooltip message={`${author.name} <${author.email}>`} delay={800}>
            {author.name}
          </Tooltip>
        </td>
      </tr>
    );
  }

  render() {
    const { logs, branch } = this.state;
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Git History ({logs.length})</ModalHeader>
        <ModalBody className="pad">
          <table className="table--fancy table--striped">
            <thead>
              <tr>
                <th className="text-left">Message</th>
                <th className="text-left">When</th>
                <th className="text-left">Author</th>
              </tr>
            </thead>
            <tbody>{logs.map(this.renderLogEntryRow)}</tbody>
          </table>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm tall">
            <i className="fa fa-code-fork" /> {branch}
          </div>
          <div>
            <button className="btn" onClick={this.hide}>
              Done
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default GitLogModal;
