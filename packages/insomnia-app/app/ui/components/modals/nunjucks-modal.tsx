import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { Workspace } from '../../../models/workspace';
import Modal from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import TagEditor from '../templating/tag-editor';
import VariableEditor from '../templating/variable-editor';

interface Props {
  uniqueKey: string;
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  workspace: Workspace;
}

interface State {
  defaultTemplate: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class NunjucksModal extends PureComponent<Props, State> {
  state: State = {
    defaultTemplate: '',
  };

  _onDone: Function | null = null;
  _currentTemplate: string | null = null;
  modal: Modal | null = null;

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _handleTemplateChange(template: string | null) {
    this._currentTemplate = template;
  }

  _handleSubmit(e) {
    e.preventDefault();
    this.hide();
  }

  _handleModalHide() {
    if (this._onDone) {
      this._onDone(this._currentTemplate);

      this.setState({
        defaultTemplate: '',
      });
    }
  }

  show({ template, onDone }) {
    this._onDone = onDone;
    this._currentTemplate = template;
    this.setState({
      defaultTemplate: template,
    });
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { handleRender, handleGetRenderContext, uniqueKey, workspace } = this.props;
    const { defaultTemplate } = this.state;
    let editor: JSX.Element | null = null;
    let title = '';

    if (defaultTemplate.indexOf('{{') === 0) {
      title = 'Variable';
      editor = (
        <VariableEditor
          onChange={this._handleTemplateChange}
          defaultValue={defaultTemplate}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
        />
      );
    } else if (defaultTemplate.indexOf('{%') === 0) {
      title = 'Tag';
      editor = (
        <TagEditor
          onChange={this._handleTemplateChange}
          defaultValue={defaultTemplate}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          workspace={workspace}
        />
      );
    }

    return (
      <Modal ref={this._setModalRef} onHide={this._handleModalHide} key={uniqueKey}>
        <ModalHeader>Edit {title}</ModalHeader>
        <ModalBody className="pad" key={defaultTemplate}>
          <form onSubmit={this._handleSubmit}>{editor}</form>
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default NunjucksModal;
