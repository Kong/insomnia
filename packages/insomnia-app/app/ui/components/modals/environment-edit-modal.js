import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import EnvironmentEditor from '../editors/environment-editor';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

@autobind
class EnvironmentEditModal extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      requestGroup: null,
      isValid: true,
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _setEditorRef(n) {
    this._envEditor = n;
  }

  _saveChanges() {
    if (!this._envEditor.isValid()) {
      return;
    }

    let patch;
    try {
      const data = this._envEditor.getValue();
      patch = {
        environment: data && data.object,
        environmentPropertyOrder: data && data.propertyOrder,
      };
    } catch (err) {
      // Invalid JSON probably
      return;
    }
    const { requestGroup } = this.state;

    this.props.onChange(Object.assign({}, requestGroup, patch));
  }

  _didChange() {
    this._saveChanges();

    const isValid = this._envEditor.isValid();

    if (this.state.isValid !== isValid) {
      this.setState({ isValid });
    }
  }

  show(requestGroup) {
    this.setState({ requestGroup });
    this.modal.show();
  }

  hide() {
    this.modal.hide();
  }

  render() {
    const {
      editorKeyMap,
      editorFontSize,
      editorIndentSize,
      lineWrapping,
      render,
      getRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
      ...extraProps
    } = this.props;

    const { requestGroup, isValid } = this.state;

    const environmentInfo = {
      object: requestGroup ? requestGroup.environment : {},
      propertyOrder: requestGroup && requestGroup.environmentPropertyOrder,
    };

    return (
      <Modal ref={this._setModalRef} tall {...extraProps}>
        <ModalHeader>Environment Overrides (JSON Format)</ModalHeader>
        <ModalBody noScroll className="pad-top-sm">
          <EnvironmentEditor
            editorFontSize={editorFontSize}
            editorIndentSize={editorIndentSize}
            editorKeyMap={editorKeyMap}
            ref={this._setEditorRef}
            key={requestGroup ? requestGroup._id : 'n/a'}
            lineWrapping={lineWrapping}
            environmentInfo={environmentInfo}
            didChange={this._didChange}
            render={render}
            getRenderContext={getRenderContext}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm">
            * Used to override data in the global environment
          </div>
          <button className="btn" disabled={!isValid} onClick={this.hide}>
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
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  render: PropTypes.func.isRequired,
  getRenderContext: PropTypes.func.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  isVariableUncovered: PropTypes.bool.isRequired,
  lineWrapping: PropTypes.bool.isRequired,
};

export default EnvironmentEditModal;
