import React, {PureComponent} from 'react';
import classnames from 'classnames';
import CopyButton from '../base/CopyButton';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as sync from '../../../sync';

class SyncLogsModal extends PureComponent {
  state = {
    logs: []
  };

  _setModalRef = n => this.modal = n;

  show () {
    clearInterval(this._interval);
    this._interval = setInterval(() => this._updateModal(), 2000);
    this._updateModal();
    this.modal.show();
  }

  hide () {
    clearInterval(this._interval);
    this.modal.hide();
  }

  _updateModal () {
    this.setState({logs: sync.logger.tail()})
  }

  _getColorClass (level) {
    return {
        debug: 'info',
        warn: 'warning',
        error: 'danger'
      }[level] || '';
  }

  _formatLogs () {
    const {logs: allLogs} = this.state;
    const logs = allLogs.slice(allLogs.length - 1000);

    function pad (n, length) {
      let s = n + '';
      while (s.length < length) {
        s = '0' + s;
      }
      return s;
    }

    const rows = [];
    let i = 0;
    for (const entry of logs) {
      const colorClass = this._getColorClass(entry.type);
      const dateString =
        pad(entry.date.getFullYear(), 4) + '/' +
        pad(entry.date.getMonth() + 1, 2) + '/' +
        pad(entry.date.getDate(), 2) + ' ' +
        pad(entry.date.getHours(), 2) + ':' +
        pad(entry.date.getMinutes(), 2) + ':' +
        pad(entry.date.getSeconds(), 2);

      rows.push({
        jsx: (
          <pre key={i++}>
              <span className="faint">
                {dateString}
              </span>
            {" "}
            <span style={{minWidth: '4rem'}}
                  className={classnames(colorClass, 'inline-block')}>
              [{entry.type}]
            </span>
            {" "}
            {entry.message}
          </pre>
        ),
        text: `${dateString} [${entry.type}] ${entry.message}`
      })
    }

    return rows;
  }

  render () {
    const rows = this._formatLogs();
    return (
      <Modal ref={this._setModalRef} tall={true}>
        <ModalHeader>Sync Debug Logs</ModalHeader>
        <ModalBody className="pad selectable txt-sm monospace">
          {rows.map(row => row.jsx)}
        </ModalBody>
        <ModalFooter>
          <CopyButton className="btn" content={rows.map(r => r.text).join('\n')}>
            Copy To Clipboard
          </CopyButton>
        </ModalFooter>
      </Modal>
    )
  }
}

SyncLogsModal.propTypes = {};

export default SyncLogsModal;
