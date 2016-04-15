import React, {Component, PropTypes} from 'react'
import {Modal, ModalHeader, ModalBody, ModalFooter} from '../base/Modal'
import Editor from '../base/Editor'
import KeyValueEditor from '../base/KeyValueEditor'
import * as modalIds from '../../constants/modals'

class EnvironmentEditModal extends Component {
  render () {
    const editorOptions = {
      mode: 'application/json',
      placeholder: '{ "array": [1, 2, 3, 4] }',
      theme: 'neat'
    };

    return (
      <Modal {...this.props}>
        <ModalHeader>Environment Variables</ModalHeader>
        <ModalBody className="grid--v wide pad">
          <div>
            <KeyValueEditor onChange={() => {}}
                            pairs={[{name: 'foo', value: 'hello'}]}
                            namePlaceholder="BASE_URL"
                            valuePlaceholder="https://api.insomnia.com/v1"/>
          </div>
          {/*
          <h3>Hello</h3>
          <Editor value={undefined} options={editorOptions}/>
          */}
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
