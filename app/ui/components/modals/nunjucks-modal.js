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
      template: ''
    };

    this._onDone = null;
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _handleTemplateChange (template) {
    this.setState({template});
  }

  show ({template, onDone}) {
    this._onDone = onDone;

    this.setState({template});

    this.modal.show();
    trackEvent('Nunjucks', 'Editor', 'Show');
  }

  hide () {
    this.modal.hide();
    trackEvent('Nunjucks', 'Editor', 'Hide');
  }

  _handleSubmit (e) {
    e.preventDefault();
    this._onDone && this._onDone(this.state.template);
    this.hide();
  }

  render () {
    const {handleRender} = this.props;
    const {template} = this.state;

    let editor = null;
    if (template.indexOf('{{') === 0) {
      editor = (
        <VariableEditor
          onChange={this._handleTemplateChange}
          defaultValue={template}
          handleRender={handleRender}
        />
      );
    } else if (template.indexOf('{%') === 0) {
      editor = (
        <TagEditor
          onChange={this._handleTemplateChange}
          defaultValue={template}
          handleRender={handleRender}
        />
      );
    }

    return (
      <Modal ref={this._setModalRef}>
        <form onSubmit={this._handleSubmit}>
          <ModalHeader>Edit Variable</ModalHeader>
          <ModalBody className="pad" key={template}>
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
