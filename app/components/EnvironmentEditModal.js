import React, {PropTypes} from 'react'

import Link from './base/Link'
import Modal from './base/Modal'
import ModalBody from './base/ModalBody'
import ModalHeader from './base/ModalHeader'
import ModalFooter from './base/ModalFooter'
import KeyValueEditor from './base/KeyValueEditor'
import ModalComponent from './lib/ModalComponent'


class EnvironmentEditModal extends ModalComponent {
  constructor (props) {
    super(props);
    this.requestGroup = null;
    this.state = {
      pairs: [],
      uniquenessKey: ''
    }
  }

  _saveChanges () {
    const environment = this._mapPairsToData(this.state.pairs);
    this.props.onChange(Object.assign({}, this.requestGroup, {environment}));
    this.hide();
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

  _update (requestGroup) {
    this.requestGroup = requestGroup;
    this.setState({
      pairs: this._mapDataToPairs(requestGroup.environment),
      uniquenessKey: requestGroup._id
    })
  }

  show (requestGroup) {
    super.show();
    this._update(requestGroup);
  }

  toggle (requestGroup) {
    super.toggle();
    this._update(requestGroup);
  }

  render () {
    const {uniquenessKey, pairs} = this.state;

    return (
      <Modal ref="modal" tall={true} {...this.props}>
        <ModalHeader>Environment Variables</ModalHeader>
        <ModalBody>
          <KeyValueEditor onChange={this._keyValueChange.bind(this)}
                          uniquenessKey={uniquenessKey}
                          pairs={pairs}
                          namePlaceholder="BASE_URL"
                          valuePlaceholder="https://api.insomnia.com/v1"/>
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={this._saveChanges.bind(this)}>Save</button>
          </div>
          <div className="pad txt-sm">
            This data can be used for&nbsp;
            <Link href="https://mozilla.github.io/nunjucks/templating.html">Nunjucks Templating</Link>&nbsp;
            in your requests.
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

EnvironmentEditModal.propTypes = {
  onChange: PropTypes.func.isRequired
};

export default EnvironmentEditModal;
