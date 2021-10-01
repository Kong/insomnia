import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { RequestGroup } from '../../../models/request-group';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { EnvironmentEditor } from '../editors/environment-editor';

interface Props {
  onChange: Function;
  editorFontSize: number;
  editorIndentSize: number;
  editorKeyMap: string;
  render: HandleRender;
  getRenderContext: HandleGetRenderContext;
  nunjucksPowerUserMode: boolean;
  isVariableUncovered: boolean;
  lineWrapping: boolean;
}

interface State {
  requestGroup: RequestGroup | null;
  isValid: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class EnvironmentEditModal extends PureComponent<Props, State> {
  state: State = {
    requestGroup: null,
    isValid: true,
  };

  modal: Modal | null = null;
  _envEditor: EnvironmentEditor | null = null;

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _setEditorRef(n: EnvironmentEditor) {
    this._envEditor = n;
  }

  _saveChanges() {
    if (!this._envEditor?.isValid()) {
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

    const isValid = Boolean(this._envEditor?.isValid());

    if (this.state.isValid !== isValid) {
      this.setState({ isValid });
    }
  }

  show(requestGroup) {
    this.setState({ requestGroup });
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
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
