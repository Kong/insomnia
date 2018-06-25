import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import VariableEditor from '../templating/variable-editor';
import TagEditor from '../templating/tag-editor';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

@autobind
class NunjucksModal extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      defaultTemplate: ''
    };

    this._onDone = null;
    this._currentTemplate = null;
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _handleTemplateChange(template) {
    this._currentTemplate = template;
  }

  _handleSubmit(e) {
    e.preventDefault();
    this.hide();
  }

  _handleModalHide() {
    if (this._onDone) {
      this._onDone(this._currentTemplate);
      this.setState({ defaultTemplate: '' });
    }
  }

  show({ template, onDone }) {
    this._onDone = onDone;
    this._currentTemplate = template;

    this.setState({ defaultTemplate: template });
    this.modal.show();
  }

  hide() {
    this.modal.hide();
  }

  render() {
    const {
      handleRender,
      handleGetRenderContext,
      uniqueKey,
      workspace
    } = this.props;
    const { defaultTemplate } = this.state;

    let editor = null;
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
      <Modal
        ref={this._setModalRef}
        onHide={this._handleModalHide}
        key={uniqueKey}>
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

NunjucksModal.propTypes = {
  uniqueKey: PropTypes.string.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  workspace: PropTypes.object.isRequired
};

export default NunjucksModal;
