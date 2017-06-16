import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import HelpTooltip from '../help-tooltip';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';
import DebouncedInput from '../base/debounced-input';
import MarkdownEditor from '../markdown-editor';

@autobind
class RequestSettingsModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      request: null,
      showDescription: false,
      defaultPreviewMode: false
    };
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _setEditorRef (n) {
    this._editor = n;
  }

  async _updateRequestSettingBoolean (e) {
    const value = e.target.checked;
    const setting = e.target.name;
    const request = await models.request.update(this.state.request, {[setting]: value});
    this.setState({request});
    trackEvent('Request Settings', setting, value ? 'Enable' : 'Disable');
  }

  async _handleNameChange (name) {
    const request = await models.request.update(this.state.request, {name});
    this.setState({request});
  }

  async _handleDescriptionChange (description) {
    const request = await models.request.update(this.state.request, {description});
    this.setState({request, defaultPreviewMode: false});
  }

  _handleAddDescription () {
    trackEvent('Request', 'Add Description');
    this.setState({showDescription: true});
  }

  show ({request, forceEditMode}) {
    this.modal.show();
    const hasDescription = !!request.description;
    this.setState({
      request,
      showDescription: forceEditMode || hasDescription,
      defaultPreviewMode: hasDescription && !forceEditMode
    });

    if (forceEditMode) {
      setTimeout(() => {
        this._editor.focusEnd();
      }, 400);
    }
  }

  hide () {
    this.modal.hide();
  }

  renderCheckboxInput (setting) {
    return (
      <input
        type="checkbox"
        name={setting}
        checked={this.state.request[setting]}
        onChange={this._updateRequestSettingBoolean}
      />
    );
  }

  renderModalBody (request) {
    const {
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      handleRender,
      handleGetRenderContext
    } = this.props;

    const {showDescription, defaultPreviewMode} = this.state;

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>Name
            {' '}
            <span className="txt-sm faint italic">
              (also rename by double-clicking in sidebar)
            </span>
            <DebouncedInput
              delay={500}
              type="text"
              placeholder="My Request"
              defaultValue={request.name}
              onChange={this._handleNameChange}
            />
          </label>
        </div>
        {showDescription ? (
          <MarkdownEditor
            ref={this._setEditorRef}
            className="margin-top"
            defaultPreviewMode={defaultPreviewMode}
            fontSize={editorFontSize}
            indentSize={editorIndentSize}
            keyMap={editorKeyMap}
            placeholder="Write a description"
            lineWrapping={editorLineWrapping}
            handleRender={handleRender}
            handleGetRenderContext={handleGetRenderContext}
            defaultValue={request.description}
            onChange={this._handleDescriptionChange}
          />
        ) : (
          <button onClick={this._handleAddDescription}
                  className="btn btn--outlined btn--super-duper-compact">
            Add Description
          </button>
        )}
        <div className="pad-top">
          <div className="form-control form-control--thin">
            <label>Send cookies automatically
              {this.renderCheckboxInput('settingSendCookies')}
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>Store cookies automatically
              {this.renderCheckboxInput('settingStoreCookies')}
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>Automatically encode special characters in URL
              {this.renderCheckboxInput('settingEncodeUrl')}
              <HelpTooltip position="top" className="space-left">
                Automatically encode special characters at send time (does not apply to
                query parameters editor)
              </HelpTooltip>
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>Skip rendering of request body
              {this.renderCheckboxInput('settingDisableRenderRequestBody')}
              <HelpTooltip position="top" className="space-left">
                Disable rendering of environment variables and tags for the request body
              </HelpTooltip>
            </label>
          </div>
        </div>
      </div>
    );
  }

  render () {
    const {request} = this.state;
    return (
      <Modal ref={this._setModalRef} freshState>
        <ModalHeader>
          Request Settings
          {' '}
          <span className="txt-sm selectable faint monospace">{request ? request._id : ''}</span>
        </ModalHeader>
        <ModalBody className="pad">
          {request ? this.renderModalBody(request) : null}
        </ModalBody>
      </Modal>
    );
  }
}

RequestSettingsModal.propTypes = {
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired,
  editorLineWrapping: PropTypes.bool.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired
};

export default RequestSettingsModal;
