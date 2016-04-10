import React, {Component, PropTypes} from 'react'
import {Modal, ModalHeader, ModalBody, ModalFooter} from '../base/Modal'
import Editor from '../base/Editor'
import * as modalIds from '../../constants/modals'

class EnvironmentEditModal extends Component {
  render () {
    const editorOptions = {
      mode: 'application/json',
      placeholder: '{ "base_url": "https://website.com/api" }',
      theme: 'neat'
    };

    return (
      <Modal {...this.props}>
        <ModalHeader>Edit Environments</ModalHeader>
        <ModalBody className="grid--v wide">
          <Editor value={undefined}
                  options={editorOptions}/>
        </ModalBody>
        <ModalFooter className="text-right">
          <button className="btn">Done</button>
        </ModalFooter>
      </Modal>
    );
  }
}

EnvironmentEditModal.propTypes = {};

EnvironmentEditModal.defaultProps = {
  id: modalIds.ENVIRONMENT_EDITOR
};

export default EnvironmentEditModal;
