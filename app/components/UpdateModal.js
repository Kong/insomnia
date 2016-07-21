import {ipcRenderer} from 'electron';
import React from 'react';

import Modal from './base/Modal';
import ModalBody from './base/ModalBody';
import ModalHeader from './base/ModalHeader';
import ModalFooter from './base/ModalFooter';
import ModalComponent from './lib/ModalComponent';

class UpdateModal extends ModalComponent {
  constructor (props) {
    super(props);
    this.state = {
      loading: false,
      releaseName: null
    }
  }

  _handleUpdate () {
    ipcRenderer.send('install-update');
    this.setState({loading: true})
  }

  componentDidMount () {
    ipcRenderer.on('update-available', (e, releaseName) => {
      this.show();
      this.setState({releaseName});
    })
  }

  render () {
    const {loading, releaseName} = this.state;

    return (
      <Modal ref="modal">
        <ModalHeader>New Update Available {releaseName}</ModalHeader>
        <ModalBody className="wide pad">
          {loading ? (
            <i className="fa fa-refresh fa-spin txt-lg"></i>
          ) : (
            <div>
              <h1>Exciting News! &nbsp;٩(⁎❛ᴗ❛⁎)۶</h1>
              <p>
                A fresh new update has been downloaded and is ready to install.
              </p>
              <br/>
              <p>~Gregory</p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={e => this.hide()}>
              Later
            </button>
            <button className="btn" onClick={e => this._handleUpdate()}>
              Install and Restart
            </button>
          </div>
          <div className="pad faint italic txt-sm tall">
            * your stuff will still be here when you get back
          </div>
        </ModalFooter>
      </Modal>
    )
  }
}

UpdateModal.propTypes = {};

export default UpdateModal;
