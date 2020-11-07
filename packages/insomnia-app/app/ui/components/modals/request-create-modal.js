// @flow
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
  METHOD_DELETE,
  METHOD_GRPC,
} from '../../../common/constants';
import * as models from '../../../models/index';
import { trackEvent } from '../../../common/analytics';
import { showModal } from './index';
import ProtoFilesModal from './proto-files-modal';

type RequestCreateModalOptions = {
  parentId: string,
  onComplete: string => void,
};

@autobind
class RequestCreateModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      selectedContentType: null,
      selectedMethod: METHOD_GET,
      parentId: null,
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _setInputRef(n) {
    this._input = n;
    if (this._input) {
      this._input.value = 'My Request';
      this._input.placeholder = 'My Request';
    }
  }

  async _handleSubmit(e) {
    e.preventDefault();

    const { parentId, selectedContentType, selectedMethod } = this.state;
    const requestName = this._input.value;
    if (selectedMethod === METHOD_GRPC) {
      showModal(ProtoFilesModal, {
        onSave: async (protoFileId: string) => {
          const createdRequest = await models.grpcRequest.create({
            parentId,
            name: requestName,
            protoFileId,
          });

          this._onComplete(createdRequest._id);
        },
      });
    } else {
      const request = await models.initModel(models.request.type, {
        parentId,
        name: requestName,
        method: selectedMethod,
      });

      const finalRequest = await models.request.updateMimeType(
        request,
        this._shouldNotHaveBody() ? null : selectedContentType,
        true,
      );

      this._onComplete(finalRequest._id);
    }

    this.hide();

    trackEvent('Request', 'Create');
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
      selectedMethod === METHOD_OPTIONS ||
      selectedMethod === METHOD_GRPC
    );
  }

  hide() {
    this.modal.hide();
  }

  show({ parentId, onComplete }: RequestCreateModalOptions) {
    this.setState({
      parentId,
      selectedContentType: null,
      selectedMethod: METHOD_GET,
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
                  <span className="txt-sm faint italic space-left">
                    (defaults to your request URL if left empty)
                  </span>
                  <input ref={this._setInputRef} type="text" />
                </label>
              </div>
              <div className="form-control form-control--no-label" style={{ width: 'auto' }}>
                <MethodDropdown
                  right
                  showGrpc
                  className="btn btn--clicky no-wrap"
                  method={selectedMethod}
                  onChange={this._handleChangeSelectedMethod}
                />
              </div>
              {!this._shouldNotHaveBody() && (
                <div className="form-control form-control--no-label" style={{ width: 'auto' }}>
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
