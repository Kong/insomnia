import React, {Component} from 'react';
import ContentTypeDropdown from '../dropdowns/ContentTypeDropdown';
import MethodDropdown from '../dropdowns/MethodDropdown';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import {getContentTypeName, METHOD_GET, METHOD_HEAD, METHOD_OPTIONS} from '../../../common/constants';
import * as models from '../../../models/index';
import {trackEvent} from '../../../analytics/index';

class RequestCreateModal extends Component {
  constructor (props) {
    super(props);

    let contentType;
    try {
      contentType = JSON.parse(localStorage.getItem('insomnia::createRequest::contentType'));
    } catch (e) {
    }

    let method;
    try {
      method = JSON.parse(localStorage.getItem('insomnia::createRequest::method'));
    } catch (e) {
    }

    this.state = {
      selectedContentType: contentType || null,
      selectedMethod: method || METHOD_GET,
      parentId: null,
    };
  }

  _handleSubmit = async e => {
    e.preventDefault();

    const {parentId, selectedContentType, selectedMethod} = this.state;
    const request = models.initModel(models.request.type, {
      parentId,
      name: this._input.value,
      method: selectedMethod,
    });

    const finalRequest = await models.request.updateMimeType(
      request,
      selectedContentType,
      true,
    );

    this._onSubmitCallback(finalRequest);

    this.hide();
  };

  _handleChangeSelectedContentType = selectedContentType => {
    this.setState({selectedContentType});
    localStorage.setItem(
      'insomnia::createRequest::contentType',
      JSON.stringify(selectedContentType)
    );
    trackEvent('Request Create', 'Content Type Change', selectedContentType);
  };

  _handleChangeSelectedMethod = selectedMethod => {
    this.setState({selectedMethod});
    localStorage.setItem(
      'insomnia::createRequest::method',
      JSON.stringify(selectedMethod)
    );
    trackEvent('Request Create', 'Method Change', selectedMethod);
  };

  _handleHide = () => this.hide();

  hide () {
    this.modal.hide();
  }

  show ({parentId}) {
    this.modal.show();

    this._input.value = 'My Request';
    this.setState({parentId});

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._input.focus();
      this._input.select();
    }, 100);

    return new Promise(resolve => this._onSubmitCallback = resolve);
  }

  render () {
    const {selectedContentType, selectedMethod} = this.state;
    const shouldNotHaveBody =
      selectedMethod === METHOD_GET ||
      selectedMethod === METHOD_HEAD ||
      selectedMethod === METHOD_OPTIONS;

    return (
      <Modal ref={m => this.modal = m}>
        <ModalHeader>Create HTTP Request</ModalHeader>
        <ModalBody noScroll={true}>
          <form onSubmit={this._handleSubmit} className="pad row-fill">
            <div className="form-control form-control--outlined form-control--wide wide">
              <input ref={n => this._input = n} type="text"/>
            </div>
            <div className="pad-left-sm">
              <MethodDropdown
                className="btn btn--clicky no-wrap"
                right={true}
                method={selectedMethod}
                onChange={this._handleChangeSelectedMethod}
              />
            </div>
            {!shouldNotHaveBody ? (
              <div className="pad-left-sm">
                <ContentTypeDropdown className="btn btn--clicky no-wrap"
                                     right={true}
                                     onChange={this._handleChangeSelectedContentType}>
                  {getContentTypeName(selectedContentType)}
                  {" "}
                  <i className="fa fa-caret-down"></i>
                </ContentTypeDropdown>
              </div>
            ) : null}
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">
            * hint: 'TIP: Import Curl command by pasting it into the URL bar'
          </div>
          <div>
            <button className="btn" onClick={this._handleHide}>
              Cancel
            </button>
            <button className="btn" onClick={this._handleSubmit}>
              Create
            </button>
          </div>
        </ModalFooter>
      </Modal>
    )
  }
}

RequestCreateModal.propTypes = {};

export default RequestCreateModal;
