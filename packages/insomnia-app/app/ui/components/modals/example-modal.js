import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import ContentTypeDropdown from '../dropdowns/content-type-dropdown';
// import MethodDropdown from '../dropdowns/method-dropdown';
import ExamplesEditor from '../editors/examples-editor';
import StatusCodeDropdown from '../dropdowns/status-code-dropdown';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import { getContentTypeName } from '../../../common/constants';

@autobind
class ExampleModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      request: null,
      title: '',
      body: '',
      contentType: 'application/json',
      statusCode: 200,
      editorSettings: {},
      handleRender: null,
      handleGetRenderContext: null,
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _setInputRef(n) {
    this._input = n;
  }

  async _handleSubmit(e) {
    e.preventDefault();

    const { title, body, statusCode, contentType } = this.state;

    console.log('[Added Example] ', { title, body, statusCode, contentType });

    this._onComplete({ title, body, statusCode, contentType });

    this.hide();

    // trackEvent('Request', 'Create');
  }

  _handleChangeSelectedContentType(contentType) {
    // let { example } = this.state
    // example.contentType = selectedContentType;
    this.setState({ contentType });
  }

  _handleChangeSelectedStatusCode(statusCode) {
    // let { example } = this.state
    // example.statusCode = selectedStatusCode;
    this.setState({ statusCode });
  }

  _handleExampleBody(body) {
    // let { example } = this.state
    // example.body = exampleBody;
    this.setState({ body });
  }

  _handleExampleTitle(event) {
    // let { example } = this.state
    // example.title = event.target.value;
    this.setState({ title: event.target.value });
  }

  hide() {
    this.modal.hide();
  }

  show({ example, request, editorSettings, handleRender, handleGetRenderContext, onComplete }) {
    const { title, body, statusCode, contentType } = example || {
      title: '',
      body: '',
      statusCode: 200,
      contentType: 'application/json',
    };

    this.setState({
      title,
      body,
      contentType,
      statusCode,
      editorSettings,
      handleRender,
      handleGetRenderContext,
      request,
    });

    this.modal.show();

    // Need to do this after render because modal focuses itself too
    // setTimeout(() => {
    //   this._input.focus();
    //   this._input.select();
    // }, 200);

    this._onComplete = onComplete;
  }

  render() {
    const {
      request,
      title,
      body,
      contentType,
      statusCode,
      editorSettings,
      handleRender,
      handleGetRenderContext,
    } = this.state;
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>New Request</ModalHeader>
        <ModalBody className="pad">
          <form onSubmit={this._handleSubmit} className="pad">
            <div className="form-row">
              <div className="form-control form-control--outlined">
                <label>
                  Name
                  <span className="txt-sm faint italic space-left">
                    (defaults to your selected status code and content type)
                  </span>
                  <input
                    ref={this._setInputRef}
                    type="text"
                    value={title}
                    onChange={this._handleExampleTitle}
                  />
                </label>
              </div>
              <div className="form-control form-control--no-label" style={{ width: 'auto' }}>
                <StatusCodeDropdown
                  right
                  className="btn btn--clicky no-wrap"
                  statuscode={statusCode}
                  value={statusCode}
                  onChange={this._handleChangeSelectedStatusCode}
                />
              </div>
              <div className="form-control form-control--no-label" style={{ width: 'auto' }}>
                <ContentTypeDropdown
                  className="btn btn--clicky no-wrap"
                  right
                  contentType={contentType}
                  request={request}
                  onChange={this._handleChangeSelectedContentType}>
                  {getContentTypeName(contentType) || 'No Body'} <i className="fa fa-caret-down" />
                </ContentTypeDropdown>
              </div>
            </div>
            <hr />
            <div className="form-row">
              <ExamplesEditor
                request={request}
                settings={editorSettings}
                handleRender={handleRender}
                content={body}
                contentType={contentType}
                handleGetRenderContext={handleGetRenderContext}
                onChange={this._handleExampleBody}
              />
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={this._handleSubmit}>
            Add Example
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default ExampleModal;
