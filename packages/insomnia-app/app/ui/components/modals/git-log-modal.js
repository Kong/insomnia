// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { GitLogEntry } from '../../../sync/git/git-vcs';
import GitVCS from '../../../sync/git/git-vcs';
import ModalFooter from '../base/modal-footer';
import Tooltip from '../tooltip';
import TimeFromNow from '../time-from-now';

type Props = {|
  vcs: GitVCS,
|};

type State = {|
  log: Array<GitLogEntry>,
  branch: string,
|};

@autobind
class GitLogModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);

    this.state = {
      log: [],
      branch: '??',
    };
  }

  _setModalRef(ref: ?Modal) {
    this.modal = ref;
  }

  async show() {
    const { vcs } = this.props;

    const log = await vcs.log();
    const branch = await vcs.getBranch();

    this.setState({ log, branch });

    this.modal && this.modal.show();
  }

  hide() {
    this.modal && this.modal.hide();
  }

  renderLogEntryRow(entry: GitLogEntry) {
    const { author, message, oid } = entry;

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
    const { log, branch } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Git History ({log.length})</ModalHeader>
        <ModalBody className="pad">
          <table className="table--fancy table--striped">
            <thead>
              <tr>
                <th className="text-left">Message</th>
                <th className="text-left">When</th>
                <th className="text-left">Author</th>
              </tr>
            </thead>
            <tbody>{log.map(this.renderLogEntryRow)}</tbody>
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
