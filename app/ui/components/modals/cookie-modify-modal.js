// @flow
import React, {PureComponent} from 'react';
import {Tab, TabList, TabPanel, Tabs} from 'react-tabs';
import autobind from 'autobind-decorator';
import deepEqual from 'deep-equal';
import * as toughCookie from 'tough-cookie';
import * as models from '../../../models';
import clone from 'clone';
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import OneLineEditor from '../codemirror/one-line-editor';
import {cookieToString} from '../../../common/cookies';
import type {Cookie, CookieJar} from '../../../models/cookie-jar';
import type {Workspace} from '../../../models/workspace';

@autobind
class CookieModifyModal extends PureComponent {
  props: {
    handleRender: Function,
    handleGetRenderContext: Function,
    workspace: Workspace,
    cookieJar: CookieJar
  };

  state: {
    cookie: Cookie | null,
    rawValue: string
  };

  modal: Modal | null;
  _rawTimeout: number | null;
  _cookieUpdateTimeout: number | null;

  constructor (props: any) {
    super(props);

    this.state = {
      cookie: null,
      rawValue: ''
    };

    this._rawTimeout = null;
    this._cookieUpdateTimeout = null;
  }

  _setModalRef (n: Modal | null) {
    this.modal = n;
  }

  async show (cookie: Cookie) {
    // Dunno why this is sent as an array
    cookie = cookie[0] || cookie;

    const {cookieJar} = this.props;
    const oldCookie = cookieJar.cookies.find(c => deepEqual(c, cookie));

    if (!oldCookie) {
      // Cookie not found in jar
      return;
    }

    this.setState({cookie});

    this.modal && this.modal.show();

    trackEvent('Cookie Modifier', 'Show');
  }

  hide () {
    this.modal && this.modal.hide();
  }

  async _saveChanges (cookieJar: CookieJar) {
    await models.cookieJar.update(cookieJar);
  }

  _handleChangeRawValue (e: Event & {target: HTMLInputElement}) {
    const value = e.target.value;

    clearTimeout(this._rawTimeout);
    this._rawTimeout = setTimeout(async () => {
      const cookie = toughCookie.Cookie.parse(value);
      if (!this.state.cookie) {
        return;
      }

      await this._handleCookieUpdate(cookie);
    }, DEBOUNCE_MILLIS * 2);
  }

  async _handleCookieUpdate (newCookie: Cookie) {
    const cookie = clone(newCookie);

    // Sanitize expires field
    const expires = (new Date(cookie.expires || '')).getTime();
    if (isNaN(expires)) {
      delete cookie.expires;
    } else {
      cookie.expires = expires;
    }

    // Clone so we don't modify the original
    const cookieJar = clone(this.props.cookieJar);

    const {cookies} = cookieJar;

    const index = cookies.findIndex(c => c.id === cookie.id);

    cookieJar.cookies = [
      ...cookies.slice(0, index),
      cookie,
      ...cookies.slice(index + 1)
    ];

    this.setState({cookie});

    await this._saveChanges(cookieJar);
    trackEvent('Cookie', 'Update');

    return cookie;
  }

  _handleChange (field: string, eventOrValue: string | Event & {target: HTMLInputElement}) {
    const {cookie} = this.state;

    let value;

    if (typeof eventOrValue === 'string') {
      value = eventOrValue.trim();
    } else {
      if (eventOrValue.target.type === 'checkbox') {
        value = eventOrValue.target.checked;
      } else {
        value = eventOrValue.target.value.trim();
      }
    }

    const newCookie = Object.assign({}, cookie, {[field]: value});

    clearTimeout(this._cookieUpdateTimeout);
    this._cookieUpdateTimeout = setTimeout(async () => {
      await this._handleCookieUpdate(newCookie);
      this.setState({cookie: newCookie});
    }, DEBOUNCE_MILLIS * 2);
  }

  _capitalize (str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _getRawCookieString () {
    const {cookie} = this.state;

    if (!cookie) {
      return '';
    }

    try {
      return cookieToString(toughCookie.Cookie.fromJSON(JSON.stringify(cookie)));
    } catch (err) {
      console.warn('Failed to parse cookie string', err);
      return '';
    }
  }

  _renderInputField (field: string, error: string | null = null) {
    const {cookie} = this.state;
    const {handleRender, handleGetRenderContext} = this.props;

    if (!cookie) {
      return null;
    }

    const val = (cookie[field] || '').toString();

    return (
      <div className="form-control form-control--outlined">
        <label>
          {this._capitalize(field)} <span className="danger">{error}</span>
          <OneLineEditor
            render={handleRender}
            getRenderContext={handleGetRenderContext}
            defaultValue={val || ''}
            onChange={value => this._handleChange(field, value)}/>
        </label>
      </div>
    );
  }

  render () {
    const {cookieJar} = this.props;
    const {cookie} = this.state;
    const checkFields = ['secure', 'httpOnly'];

    return (
      <Modal ref={this._setModalRef} {...this.props}>
        <ModalHeader>Edit Cookie</ModalHeader>
        <ModalBody className="cookie-modify">
          {cookieJar && cookie && (
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
                  <div className="form-row">
                    {this._renderInputField('key')}
                    {this._renderInputField('value')}
                  </div>
                  <div className="form-row">
                    {this._renderInputField('domain')}
                    {this._renderInputField('path')}
                  </div>
                  {this._renderInputField(
                    'expires',
                    isNaN(new Date(cookie.expires || 0).getTime()) ? 'Invalid Date' : null
                  )}
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
                          onChange={e => this._handleChange(field, e)}
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
                           defaultValue={this._getRawCookieString()}/>
                  </label>
                </div>
              </TabPanel>
            </Tabs>
          )}
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

// export CookieModifyModal;
export default CookieModifyModal;
