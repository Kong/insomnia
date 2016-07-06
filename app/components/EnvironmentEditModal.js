import React, {Component, PropTypes} from 'react'

import Modal from './base/Modal'
import ModalBody from './base/ModalBody'
import ModalHeader from './base/ModalHeader'
import ModalFooter from './base/ModalFooter'
import KeyValueEditor from './base/KeyValueEditor'
import {MODAL_ENVIRONMENT_EDITOR} from '../lib/constants'

class EnvironmentEditModal extends Component {
  constructor(props) {
    super(props);
    this.requestGroup = null;
    this.state = {
      pairs: []
    }
  }

  _saveChanges() {
    const environment = this._mapPairsToData(this.state.pairs);
    this.props.onChange(Object.assign({}, this.requestGroup, {environment}));
    this.hide();
  }

  _keyValueChange(pairs) {
    this.setState({pairs});
  }

  _mapPairsToData(pairs) {
    return pairs.reduce((prev, curr) => {
      return Object.assign({}, prev, {[curr.name]: curr.value});
    }, {});
  }

  _mapDataToPairs(data) {
    return Object.keys(data).map(key => ({name: key, value: data[key]}));
  }

  toggle(requestGroup) {
    this.requestGroup = requestGroup;
    this.setState({pairs: this._mapDataToPairs(requestGroup.environment)})
    this.refs.modal.toggle();
  }

  hide() {
    this.refs.modal.hide();
  }

  render() {
    return (
      <Modal ref="modal" {...this.props}>
        <ModalHeader>Environment Variables</ModalHeader>
        <ModalBody>
          <KeyValueEditor onChange={this._keyValueChange.bind(this)}
                          uniquenessKey={this.props.uniquenessKey}
                          pairs={this.state.pairs}
                          namePlaceholder="BASE_URL"
                          valuePlaceholder="https://api.insomnia.com/v1"/>
        </ModalBody>
        <ModalFooter className="text-right">
          <button className="btn" onClick={this._saveChanges.bind(this)}>Done</button>
        </ModalFooter>
      </Modal>
    );
  }
}

EnvironmentEditModal.propTypes = {
  uniquenessKey: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};

EnvironmentEditModal.defaultProps = {
  id: MODAL_ENVIRONMENT_EDITOR
};

export default EnvironmentEditModal;
