import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import EnvironmentEditor from '../editors/environment-editor';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

@autobind
class EnvironmentEditModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      requestGroup: null,
      isValid: true
    };
  }

  _hide () {
    this.modal.hide();
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _setEditorRef (n) {
    this._envEditor = n;
  }

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
    const {
      editorKeyMap,
      editorFontSize,
      lineWrapping,
      render,
      ...extraProps
    } = this.props;

    const {
      requestGroup,
      isValid
    } = this.state;

    return (
      <Modal ref={this._setModalRef} tall top {...extraProps}>
        <ModalHeader>Environment Overrides (JSON Format)</ModalHeader>
        <ModalBody noScroll>
          <EnvironmentEditor
            lightTheme
            editorFontSize={editorFontSize}
            editorKeyMap={editorKeyMap}
            ref={this._setEditorRef}
            key={requestGroup ? requestGroup._id : 'n/a'}
            lineWrapping={lineWrapping}
            environment={requestGroup ? requestGroup.environment : {}}
            didChange={this._didChange}
            render={render}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm">
            * this can be used to override data in the global environment
          </div>
          <button className="btn" disabled={!isValid} onClick={this._hide}>
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
  editorKeyMap: PropTypes.string.isRequired,
  render: PropTypes.func.isRequired,
  lineWrapping: PropTypes.bool.isRequired
};

export default EnvironmentEditModal;
