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

  show ({template, onDone}) {
    this._onDone = onDone;

    this.setState({
      defaultTemplate: template
    });

    trackEvent('Nunjucks', 'Editor', 'Show');

    // NOTE: This must be called after setState() above because show() is going
    // to force refresh the modal
    this.modal.show();
  }

  hide () {
    this.modal.hide();
    trackEvent('Nunjucks', 'Editor', 'Hide');
  }

  _handleSubmit (e) {
    e.preventDefault();
    this._onDone && this._onDone(this._currentTemplate);
    this.hide();
  }

  render () {
    const {handleRender} = this.props;
    const {defaultTemplate} = this.state;

    let editor = null;
    let title = '';
    if (defaultTemplate.indexOf('{{') === 0) {
      title = 'Variable Reference';
      editor = (
        <VariableEditor
          onChange={this._handleTemplateChange}
          defaultValue={defaultTemplate}
          handleRender={handleRender}
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
      <Modal ref={this._setModalRef} freshState>
        <form onSubmit={this._handleSubmit}>
          <ModalHeader>Edit {title}</ModalHeader>
          <ModalBody className="pad">
            {editor}
          </ModalBody>
          <ModalFooter>
            <button className="btn">Done</button>
          </ModalFooter>
        </form>
      </Modal>
    );
  }
}

NunjucksModal.propTypes = {
  handleRender: PropTypes.func.isRequired
};

export default NunjucksModal;
