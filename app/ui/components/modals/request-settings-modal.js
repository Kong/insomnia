import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import HelpTooltip from '../help-tooltip';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';
import DebouncedInput from '../base/debounced-input';

@autobind
class RequestSettingsModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      request: null
    };
  }

  _setModalRef (n) {
    this.modal = n;
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

  show (request) {
    this.modal.show();
    this.setState({request});
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
    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>Request Name
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
        <div className="pad-top-sm">
          <h2 className="txt-lg">Cookie Handling</h2>
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
        </div>
        <div className="pad-top-sm">
          <h2 className="txt-lg">Advanced Settings</h2>
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
        <ModalHeader>Request Settings</ModalHeader>
        <ModalBody className="pad">
          {request ? this.renderModalBody(request) : null}
        </ModalBody>
      </Modal>
    );
  }
}

RequestSettingsModal.propTypes = {};

export default RequestSettingsModal;
