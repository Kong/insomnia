import React, {Component, PropTypes} from 'react'

import Modal from './base/Modal'
import ModalBody from './base/ModalBody'
import ModalHeader from './base/ModalHeader'
import ModalFooter from './base/ModalFooter'
import KeyValueEditor from './base/KeyValueEditor'
import {MODAL_ENVIRONMENT_EDITOR} from '../lib/constants'

class EnvironmentEditModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      pairs: this._mapDataToPairs(props.requestGroup.environment)
    }
  }

  _saveChanges () {
    const environment = this._mapPairsToData(this.state.pairs);
    this.props.onChange(Object.assign({}, this.props.requestGroup, {environment}));
    this.props.onClose();
  }

  _keyValueChange (pairs) {
    this.setState({pairs});
  }

  _mapPairsToData (pairs) {
    return pairs.reduce((prev, curr) => {
      return Object.assign({}, prev, {[curr.name]: curr.value});
    }, {});
  }

  _mapDataToPairs (data) {
    return Object.keys(data).map(key => ({name: key, value: data[key]}));
  }

  componentWillReceiveProps (nextProps) {
    this.setState({
      pairs: this._mapDataToPairs(nextProps.requestGroup.environment)
    })
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
        <ModalBody className="wide pad">
            <KeyValueEditor onChange={this._keyValueChange.bind(this)}
                            uniquenessKey={this.props.requestGroup._id}
                            pairs={this.state.pairs}
                            namePlaceholder="BASE_URL"
                            valuePlaceholder="https://api.insomnia.com/v1"/>
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

EnvironmentEditModal.propTypes = {
  requestGroup: PropTypes.shape({
    environment: PropTypes.object.isRequired
  }),
  onChange: PropTypes.func.isRequired
};

EnvironmentEditModal.defaultProps = {
  id: MODAL_ENVIRONMENT_EDITOR
};

export default EnvironmentEditModal;
