import React, {PropTypes, Component} from 'react';

import EnvironmentEditor from '../editors/EnvironmentEditor';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';


class EnvironmentEditModal extends Component {
  state = {
    requestGroup: null,
    isValid: true
  };

  _saveChanges () {
    if (!this._envEditor.isValid()) {
      return;
    }

    const environment = this._envEditor.getValue();
    const {requestGroup} = this.state;

    this.props.onChange(Object.assign({}, requestGroup, {environment}));
  }

  _didChange () {
    this._saveChanges();

    const isValid = this._envEditor.isValid();

    if (this.state.isValid !== isValid) {
      this.setState({isValid});
    }
  }

  show (requestGroup) {
    this.modal.show();
    this.setState({requestGroup});
  }

  toggle (requestGroup) {
    this.modal.toggle();
    this.setState({requestGroup});
  }

  render () {
    const {editorFontSize, ...extraProps} = this.props;
    const {requestGroup, isValid} = this.state;

    return (
      <Modal ref={m => this.modal = m} tall={true} top={true} {...extraProps}>
        <ModalHeader>Environment Overrides (JSON Format)</ModalHeader>
        <ModalBody noScroll={true}>
          <EnvironmentEditor
            editorFontSize={editorFontSize}
            ref={node => this._envEditor = node}
            key={requestGroup ? requestGroup._id : 'n/a'}
            environment={requestGroup ? requestGroup.environment : {}}
            didChange={this._didChange.bind(this)}
            lightTheme={true}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm">
            * this can be used to override data in the global environment
          </div>
          <button className="btn" disabled={!isValid} onClick={e => this.modal.hide()}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

EnvironmentEditModal.propTypes = {
  onChange: PropTypes.func.isRequired,
  editorFontSize: PropTypes.number.isRequired,
};

export default EnvironmentEditModal;
