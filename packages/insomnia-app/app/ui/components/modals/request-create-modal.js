import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import ContentTypeDropdown from '../dropdowns/content-type-dropdown';
import MethodDropdown from '../dropdowns/method-dropdown';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import {
  getContentTypeName,
  METHOD_GET,
  METHOD_HEAD,
  METHOD_OPTIONS,
  METHOD_DELETE
} from '../../../common/constants';
import * as models from '../../../models/index';

@autobind
class RequestCreateModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      selectedContentType: null,
      selectedMethod: METHOD_GET,
      parentId: null
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _setInputRef(n) {
    this._input = n;
    if (this._input) {
      this._input.value = 'My Request';
    }
  }

  async _handleSubmit(e) {
    e.preventDefault();

    const { parentId, selectedContentType, selectedMethod } = this.state;
    const request = await models.initModel(models.request.type, {
      parentId,
      name: this._input.value,
      method: selectedMethod
    });

    const finalRequest = await models.request.updateMimeType(
      request,
      this._shouldNotHaveBody() ? null : selectedContentType,
      true
    );

    this._onComplete(finalRequest);

    this.hide();
  }

  _handleChangeSelectedContentType(selectedContentType) {
    this.setState({ selectedContentType });
  }

  _handleChangeSelectedMethod(selectedMethod) {
    this.setState({ selectedMethod });
  }

  _shouldNotHaveBody() {
    const { selectedMethod } = this.state;
    return (
      selectedMethod === METHOD_GET ||
      selectedMethod === METHOD_HEAD ||
      selectedMethod === METHOD_DELETE ||
      selectedMethod === METHOD_OPTIONS
    );
  }

  hide() {
    this.modal.hide();
  }

  show({ parentId, onComplete }) {
    this.setState({
      parentId,
      selectedContentType: null,
      selectedMethod: METHOD_GET
    });

    this.modal.show();

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._input.focus();
      this._input.select();
    }, 200);

    this._onComplete = onComplete;
  }

  render() {
    const { selectedContentType, selectedMethod } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>New Request</ModalHeader>
        <ModalBody noScroll>
          <form onSubmit={this._handleSubmit} className="pad">
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  Name
                  <input ref={this._setInputRef} type="text" />
                </label>
              </div>
              <div
                className="form-control form-control--no-label"
                style={{ width: 'auto' }}>
                <MethodDropdown
                  right
                  className="btn btn--clicky no-wrap"
                  method={selectedMethod}
                  onChange={this._handleChangeSelectedMethod}
                />
              </div>
              {!this._shouldNotHaveBody() && (
                <div
                  className="form-control form-control--no-label"
                  style={{ width: 'auto' }}>
                  <ContentTypeDropdown
                    className="btn btn--clicky no-wrap"
                    right
                    contentType={selectedContentType}
                    request={null}
                    onChange={this._handleChangeSelectedContentType}>
                    {getContentTypeName(selectedContentType) || 'No Body'}{' '}
                    <i className="fa fa-caret-down" />
                  </ContentTypeDropdown>
                </div>
              )}
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm tall">
            * Tip: paste Curl command into URL afterwards to import it
          </div>
          <button className="btn" onClick={this._handleSubmit}>
            Create
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default RequestCreateModal;
