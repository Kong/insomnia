// @flow
import React, {PureComponent} from 'react';
import {Tabs, TabList, Tab, TabPanel} from 'react-tabs';
import autobind from 'autobind-decorator';
import * as toughCookie from 'tough-cookie';
import * as models from '../../../models';
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
    rawValue: string,
    isValid: {
      key: boolean,
      value: boolean,
      domain: boolean,
      path: boolean,
      expires: boolean
    }
  };

  modal: Modal | null;
  _rawTimeout: number | null;
  _cookieUpdateTimeout: number | null;

  constructor (props: any) {
    super(props);

    this.state = {
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

    this._rawTimeout = null;
    this._cookieUpdateTimeout = null;
  }

  _setModalRef (n: Modal | null) {
    this.modal = n;
  }

  async show (cookie: Cookie) {
    // Dunno why this is sent as an array
    cookie = cookie[0] || cookie;
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

      await this._handleCookieUpdate(this.state.cookie, cookie);
    }, DEBOUNCE_MILLIS);
  }

  async _handleCookieUpdate (oldCookie: Cookie, cookie: Cookie) {
    const {cookieJar} = this.props;
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

  _handleChange (field: string, eventOrValue: Event & {target: HTMLInputElement}) {
    const {cookie} = this.state;
    let valid = true;

    const value = typeof eventOrValue === 'object'
      ? eventOrValue.target.checked
      : eventOrValue;

    if (valid) {
      const newCookie = Object.assign({}, cookie, {[field]: value});

      clearTimeout(this._cookieUpdateTimeout);
      this._cookieUpdateTimeout = setTimeout(async () => {
        if (cookie) {
          await this._handleCookieUpdate(cookie, newCookie);
          this.setState({cookie: newCookie});
        }
      }, DEBOUNCE_MILLIS * 2);
    }

    this.setState({
      isValid: {
        ...this.state.isValid,
        [field]: valid
      }
    });
  }

  _capitalize (str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  render () {
    const {
      cookieJar,
      handleRender,
      handleGetRenderContext
    } = this.props;

    if (!cookieJar) {
      return null;
    }

    const {
      isValid,
      cookie
    } = this.state;

    if (!cookie || !cookieJar) {
      return null;
    }

    const textFields = ['key', 'value', 'domain', 'path', 'expires'];
    const checkFields = ['secure', 'httpOnly'];

    let rawCookieString = '';
    try {
      rawCookieString = cookieToString(toughCookie.Cookie.fromJSON(JSON.stringify(cookie)));
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
                          forceEditor
                          type="text"
                          render={handleRender}
                          getRenderContext={handleGetRenderContext}
                          defaultValue={val || ''}
                          onChange={value => this._handleChange(field, value)}/>
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

// export CookieModifyModal;
export default CookieModifyModal;
