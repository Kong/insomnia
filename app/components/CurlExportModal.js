import React from 'react';
import ReactDOM from 'react-dom'

import ModalComponent from './lib/ModalComponent';
import Modal from './base/Modal';
import ModalBody from './base/ModalBody';
import ModalHeader from './base/ModalHeader';
import ModalFooter from './base/ModalFooter';
import {MODAL_CURL_EXPORT} from '../lib/constants';
import {exportCurl} from '../lib/export/curl';

class CurlExportModal extends ModalComponent {
  constructor (props) {
    super(props);
    this.state = {cmd: ''};
  }
  
  show (request) {
    super.show();

    exportCurl(request._id).then(cmd => {
      this.setState({cmd});
    });
  }

  componentDidUpdate () {
    ReactDOM.findDOMNode(this.refs.textarea).select();
  }

  render () {
    const {cmd} = this.state;

    return (
      <Modal ref="modal" tall={true} {...this.props}>
        <ModalHeader>Export Request as Curl</ModalHeader>
        <ModalBody className="grid pad">
          <div className="form-control form-control--outlined no-margin tall">
            <textarea
              ref="textarea"
              className="no-resize monospace tall"
              onChange={e => {}}
              value={cmd}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={e => this.hide()}>Done</button>
          </div>
          <div className="pad faint italic txt-sm tall">
            * copy/paste this command into a Unix terminal
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

CurlExportModal.propTypes = {};

export default CurlExportModal;
