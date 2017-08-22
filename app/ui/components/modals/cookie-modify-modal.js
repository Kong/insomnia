import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {Tabs, TabList, Tab, TabPanel} from 'react-tabs';
import autobind from 'autobind-decorator';
import {Cookie} from 'tough-cookie';
import * as models from '../../../models';
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import OneLineEditor from '../codemirror/one-line-editor';
import {cookieToString} from '../../../common/cookies';

@autobind
class CookieModifyModal extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      cookieJar: null,
      cookie: null,
      rawValue: '',
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
    const cookieJar = await models.cookieJar.getOrCreateForParentId(workspace._id);
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
    await this._load();
  }

  _handleChangeRawValue (e) {
    const value = e.target.value;

    clearTimeout(this._rawTimeout);
    this._rawTimeout = setTimeout(async () => {
      const cookie = Cookie.parse(value);
      await this._handleCookieUpdate(this.state.cookie, cookie);
    }, DEBOUNCE_MILLIS);
  }

  async _handleCookieUpdate (oldCookie, cookie) {
    const {cookieJar} = this.state;
    const {cookies} = cookieJar;
    const index = cookies.findIndex(c => c.domain === oldCookie.domain && c.key === oldCookie.key);

    cookieJar.cookies = [
      ...cookies.slice(0, index),
      cookie,
      ...cookies.slice(index + 1)
    ];

    this.setState({cookie});

    await this._saveChanges(cookieJar);
    trackEvent('Cookie', 'Update');
  }

  _handleChange (input, field) {
    const {cookie} = this.state;
    let valid = true;

    if (typeof input === 'object') {
      input = input.target.checked;
    }

    if (valid) {
      const newCookie = Object.assign({}, cookie, {[field]: input});

      clearTimeout(this._cookieUpdateTimeout);
      this._cookieUpdateTimeout = setTimeout(() => {
        this._handleCookieUpdate(cookie, newCookie);
        this.setState({cookie: newCookie});
      }, DEBOUNCE_MILLIS * 2);
    }

    this.setState({
      isValid: {
        ...this.state.isValid,
        [field]: valid
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
      cookieJar
    } = this.state;

    if (!cookie || !cookieJar) {
      return null;
    }

    const textFields = ['key', 'value', 'domain', 'path', 'expires'];
    const checkFields = ['secure', 'httpOnly'];

    let rawCookieString = '';
    try {
      rawCookieString = cookieToString(Cookie.fromJSON(JSON.stringify(cookie)));
    } catch (err) {
      console.warn('Failed to parse cookie', err);
    }

    return (
      <Modal ref={this._setModalRef} {...this.props}>
        <ModalHeader>Edit Cookie</ModalHeader>
        <ModalBody className="cookie-modify">
          <Tabs>
            <TabList>
              <Tab>
                <button>Friendly</button>
              </Tab>
              <Tab>
                <button>Raw</button>
              </Tab>
            </TabList>
            <TabPanel>
              <div className="pad">
                {textFields.map((field, i) => {
                  const val = (cookie[field] || '').toString();

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
              <div className="pad no-pad-top cookie-modify__checkboxes row-around txt-lg">
                {checkFields.map((field, i) => {
                  const checked = !!cookie[field];

                  return (
                    <label key={i}>{this._capitalize(field)}
                      <input
                        className="space-left"
                        type="checkbox"
                        name={field}
                        defaultChecked={checked || false}
                        onChange={(e) => this._handleChange(e, field)}
                      />
                    </label>
                  );
                })}
              </div>
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad">
              <div className="form-control form-control--outlined">
                <label>Raw Cookie String
                  <input type="text"
                         onChange={this._handleChangeRawValue}
                         defaultValue={rawCookieString}/>
                </label>
              </div>
            </TabPanel>
          </Tabs>
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

CookieModifyModal.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  workspace: PropTypes.object.isRequired
};

// export CookieModifyModal;
export default CookieModifyModal;
