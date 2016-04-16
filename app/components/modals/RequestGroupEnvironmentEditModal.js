import React, {Component, PropTypes} from 'react'
import Modal from '../base/Modal'
import ModalBody from '../base/ModalBody'
import ModalHeader from '../base/ModalHeader'
import ModalFooter from '../base/ModalFooter'
import Editor from '../base/Editor'
import KeyValueEditor from '../base/KeyValueEditor'
import * as modalIds from '../../constants/modals'

class RequestGroupEnvironmentEditModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      pairs: []
    }
  }

  _saveChanges () {
    this.props.onChange(this.state.pairs);
  }

  _keyValueChange (pairs) {
    this.setState({pairs});
  }

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
            <KeyValueEditor onChange={this._keyValueChange.bind(this)}
                            pairs={this.state.pairs}
                            namePlaceholder="BASE_URL"
                            valuePlaceholder="https://api.insomnia.com/v1"/>
          </div>
          {/*
           <h3>Hello</h3>
           <Editor value={undefined} options={editorOptions}/>
           */}
        </ModalBody>
        <ModalFooter className="text-right">
          <button className="btn" onClick={this._saveChanges.bind(this)}>Done</button>
        </ModalFooter>
      </Modal>
    );
  }
}

RequestGroupEnvironmentEditModal.propTypes = {
  // requestGroup: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired
};

RequestGroupEnvironmentEditModal.defaultProps = {
  id: modalIds.ENVIRONMENT_EDITOR
};

export default RequestGroupEnvironmentEditModal;
