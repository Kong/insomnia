import React, {PropTypes} from 'react';

import Link from '../base/Link';
import EnvironmentEditor from '../EnvironmentEditor';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import ModalComponent from '../lib/ModalComponent';


class EnvironmentEditModal extends ModalComponent {
  constructor (props) {
    super(props);

    this.state = {
      requestGroup: null,
      isValid: true
    }
  }

  _saveChanges () {
    if (!this._envEditor.isValid()) {
      console.warn('Tried to save invalid environment');
      return;
    }

    const environment = this._envEditor.getValue();
    const {requestGroup} = this.state;

    this.props.onChange(Object.assign({}, requestGroup, {environment}));

    this.hide();
  }

  _didChange () {
    const isValid = this._envEditor.isValid();
    if (this.state.isValid !== isValid) {
      this.setState({isValid});
    }
  }

  show (requestGroup) {
    super.show();
    this.setState({requestGroup});
  }

  toggle (requestGroup) {
    super.toggle();
    this.setState({requestGroup});
  }

  render () {
    const {requestGroup, isValid} = this.state;

    return (
      <Modal ref="modal" top={true} {...this.props}>
        <ModalHeader>Environment Variables (JSON Format)</ModalHeader>
        <ModalBody>
          <div className="pad-bottom">
            <EnvironmentEditor
              ref={node => this._envEditor = node}
              key={requestGroup ? requestGroup._id : 'n/a'}
              environment={requestGroup ? requestGroup.environment : {}}
              didChange={this._didChange.bind(this)}
              lightTheme={true}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={this._saveChanges.bind(this)} disabled={!isValid}>
              Save
            </button>
          </div>
          <div className="pad faint italic txt-sm tall">
            * this data can be used for&nbsp;
            <Link href="https://mozilla.github.io/nunjucks/templating.html">
              Nunjucks Templating
            </Link> in your requests
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
