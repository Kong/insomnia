import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import * as models from '../../../models';
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import OneLineEditor from '../codemirror/one-line-editor';

@autobind
class CookieModifyModal extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      cookieJar: null,
      defaultCookie: {
        key: 'foo',
        value: 'bar',
        domain: 'domain.tld',
        path: '/',
        expires: Infinity,
        secure: false,
        httpOnly: false
      },
      cookie: null,
      isValid: {
        key: true,
        value: true,
        domain: true,
        path: true,
        expires: true
      }
    };
  }

  _setModalRef (n) {
    this.modal = n;
  }

  async _load () {
    const {workspace} = this.props;
    const cookieJar = await models.cookieJar.getOrCreateForWorkspace(workspace);
    this.setState({cookieJar});
  }

  async show (cookie) {
    await this._load();

    // Dunno why this is sent as an array
    cookie = cookie[0] || cookie;
    this.setState({cookie});

    this.modal.show();

    trackEvent('Cookie Modifier', 'Show');
  }

  hide () {
    this.modal.hide();
  }

  async _saveChanges () {
    const {cookieJar} = this.state;
    await models.cookieJar.update(cookieJar);
    this.props.reloadCookiesModal();
    this._load();
  }

  _handleCookieUpdate (oldCookie, cookie) {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;
    const index = cookies.findIndex(c => c.domain === oldCookie.domain && c.key === oldCookie.key);

    cookieJar.cookies = [
      ...cookies.slice(0, index),
      cookie,
      ...cookies.slice(index + 1)
    ];

    this._saveChanges(cookieJar);
    trackEvent('Cookie', 'Update');
  }

  _handleChange (input, field) {
    const {cookie} = this.state;
    let valid = true;

    if (typeof input === 'object') {
      input = input.target.checked;
    }

    if (valid) {
      clearTimeout(this._cookieUpdateTimeout);
      this._cookieUpdateTimeout = setTimeout(() => {
        this._handleCookieUpdate(cookie, Object.assign({}, cookie, {[field]: input}));
      }, DEBOUNCE_MILLIS * 2);
    }

    this.setState({
      isValid: {
        ...this.state.isValid,
        [field]: valid
      },
      cookie: {
        ...cookie,
        [field]: input
      }
    });
  }

  _capitalize (str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  render () {
    const {
      handleRender,
      handleGetRenderContext
    } = this.props;
    const {
      isValid,
      cookie,
      defaultCookie
    } = this.state;

    const textFields = ['key', 'value', 'domain', 'path', 'expires'];
    const checkFields = ['secure', 'httpOnly'];

    return (
      <Modal ref={this._setModalRef} {...this.props}>
        <ModalHeader>Modify Cookie</ModalHeader>
        <ModalBody className="cookie-modify">
          <div className="pad">
            {textFields.map((field, i) => {
              const val = Object.assign({}, defaultCookie, cookie)[field].toString();

              return (
                <div className="form-control form-control--outlined" key={i}>
                  <label>{this._capitalize(field)}
                    <OneLineEditor
                      className={isValid[field] ? '' : 'input--error'}
                      ref={this._setInputRef}
                      forceEditor
                      type="text"
                      render={handleRender}
                      getRenderContext={handleGetRenderContext}
                      defaultValue={val || ''}
                      onChange={(i) => this._handleChange(i, field)}/>
                  </label>
                </div>
              );
            })}
          </div>
          <div className="pad cookie-modify__checkboxes">
            {checkFields.map((field, i) => {
              const checked = Object.assign({}, defaultCookie, cookie)[field];

              return (
                <label key={i}>{this._capitalize(field)}
                  <input
                    type="checkbox"
                    name={field}
                    defaultChecked={checked || false}
                    onChange={(e) => this._handleChange(e, field)}
                  />
                </label>
              );
            })}
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">
            * cookies are automatically sent with relevant requests
          </div>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

CookieModifyModal.propTypes = {
  reloadCookiesModal: PropTypes.func.isRequired,
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  workspace: PropTypes.object.isRequired
};

// export CookieModifyModal;
export default CookieModifyModal;
