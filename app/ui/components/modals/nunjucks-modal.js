import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import VariableEditor from '../templating/variable-editor';
import TagEditor from '../templating/tag-editor';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import {trackEvent} from '../../../analytics';

@autobind
class NunjucksModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      defaultTemplate: ''
    };

    this._onDone = null;
    this._currentTemplate = null;
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _handleTemplateChange (template) {
    this._currentTemplate = template;
  }

  _handleSubmit (e) {
    e.preventDefault();
    this.hide();
  }

  _handleModalHide () {
    if (this._onDone) {
      this._onDone(this._currentTemplate);
    }
  }

  show ({template, onDone}) {
    trackEvent('Nunjucks', 'Editor', 'Show');

    this._onDone = onDone;
    this._currentTemplate = template;

    this.setState({defaultTemplate: template});
    this.modal.show();
  }

  hide () {
    this.modal.hide();
    trackEvent('Nunjucks', 'Editor', 'Hide');
  }

  render () {
    const {handleRender, handleGetRenderContext, uniqueKey} = this.props;
    const {defaultTemplate} = this.state;

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
        />
      );
    }

    return (
      <Modal ref={this._setModalRef} onHide={this._handleModalHide} key={uniqueKey}>
        <form onSubmit={this._handleSubmit}>
          <ModalHeader>Edit {title}</ModalHeader>
          <ModalBody className="pad" key={defaultTemplate}>
            {editor}
          </ModalBody>
          <ModalFooter>
            <button type="submit" className="btn">Done</button>
          </ModalFooter>
        </form>
      </Modal>
    );
  }
}

NunjucksModal.propTypes = {
  uniqueKey: PropTypes.string.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired
};

export default NunjucksModal;
