import { autoBindMethodsForReact } from 'class-autobind-decorator';
import clone from 'clone';
import { isValid } from 'date-fns';
import { cookieToString } from 'insomnia-cookies';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import * as toughCookie from 'tough-cookie';

import { AUTOBIND_CFG, DEBOUNCE_MILLIS } from '../../../common/constants';
import { capitalize } from '../../../common/misc';
import * as models from '../../../models';
import type { Cookie, CookieJar } from '../../../models/cookie-jar';
import { RootState } from '../../redux/modules';
import { selectActiveCookieJar } from '../../redux/selectors';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { OneLineEditor } from '../codemirror/one-line-editor';

type ReduxProps = ReturnType<typeof mapStateToProps>;

interface Props extends ReduxProps {
}

interface State {
  cookie: Cookie | null;
  rawValue: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class UnconnectedCookieModifyModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  _rawTimeout: NodeJS.Timeout | null = null;
  _cookieUpdateTimeout: NodeJS.Timeout | null = null;

  state: State = {
    cookie: null,
    rawValue: '',
  };

  _setModalRef(modal: Modal) {
    this.modal = modal;
  }

  async show(cookie: Cookie) {
    // Dunno why this is sent as an array
    // @ts-expect-error -- type unsoundness
    cookie = cookie[0] || cookie;
    const { activeCookeJar } = this.props;
    const prevCookie = activeCookeJar?.cookies.find(c => c.id === cookie.id);

    if (!prevCookie) {
      // Cookie not found in jar
      return;
    }

    this.setState({ cookie });
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  static async _saveChanges(cookieJar: CookieJar) {
    await models.cookieJar.update(cookieJar);
  }

  _handleChangeRawValue(event: React.SyntheticEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;
    if (this._rawTimeout !== null) {
      clearTimeout(this._rawTimeout);
    }
    this._rawTimeout = setTimeout(async () => {
      const prevCookie = this.state.cookie;
      let cookie: Cookie;

      try {
        // NOTE: Perform toJSON so we have a plain JS object instead of Cookie instance
        // @ts-expect-error -- TSCONVERSION
        cookie = toughCookie.Cookie.parse(value).toJSON();
      } catch (err) {
        console.warn(`Failed to parse cookie string "${value}"`, err);
        return;
      }

      if (!this.state.cookie || !prevCookie) {
        return;
      }

      // Make sure cookie has an id
      cookie.id = prevCookie.id;
      await this._handleCookieUpdate(cookie);
    }, DEBOUNCE_MILLIS * 2);
  }

  async _handleCookieUpdate(nextCookie: Cookie) {
    const prevCookie = this.state.cookie;
    const { activeCookeJar: prevCookieJar } = this.props;

    if (!prevCookie || !prevCookieJar) {
      // We don't have a cookie to edit
      return;
    }

    const cookie = clone(nextCookie);
    // transform to Date object or fallback to null
    let dateFormat = null;
    if (cookie.expires && isValid(new Date(cookie.expires))) {
      dateFormat = new Date(cookie.expires);
    }
    cookie.expires = dateFormat;
    // Clone so we don't modify the original
    const cookieJar = clone(prevCookieJar);
    const { cookies } = cookieJar;
    const index = cookies.findIndex(c => c.id === cookie.id);

    if (index < 0) {
      console.warn(`Could not find cookie with id=${cookie.id} to edit`);
      return;
    }

    cookieJar.cookies = [...cookies.slice(0, index), cookie, ...cookies.slice(index + 1)];
    this.setState({ cookie });
    await CookieModifyModal._saveChanges(cookieJar);
    return cookie;
  }

  _handleChange(field: string, eventOrValue: string | React.ChangeEvent<HTMLInputElement>) {
    const { cookie } = this.state;
    let value;

    if (typeof eventOrValue === 'string') {
      value = eventOrValue.trim();
    } else if (eventOrValue.target instanceof HTMLInputElement) {
      if (eventOrValue.target.type === 'checkbox') {
        value = eventOrValue.target.checked;
      } else {
        value = eventOrValue.target.value.trim();
      }
    } else {
      // Should never happen
    }

    const newCookie = Object.assign({}, cookie, {
      [field]: value,
    });
    if (this._cookieUpdateTimeout !== null) {
      clearTimeout(this._cookieUpdateTimeout);
    }
    this._cookieUpdateTimeout = setTimeout(async () => {
      await this._handleCookieUpdate(newCookie);
      this.setState({ cookie: newCookie });
    }, DEBOUNCE_MILLIS * 2);
  }

  _getRawCookieString() {
    const { cookie } = this.state;

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

  _renderInputField(field: keyof Cookie) {
    const { cookie } = this.state;

    if (!cookie) {
      return null;
    }
    let localDateTime;
    if (field === 'expires' && cookie.expires && isValid(new Date(cookie.expires))) {
      localDateTime = new Date(cookie.expires).toISOString().slice(0, 16);
    }

    const val = (cookie[field] || '').toString();
    return (
      <div className="form-control form-control--outlined">
        <label>
          {capitalize(field)}
          {field === 'expires' ?
            <input type="datetime-local" defaultValue={localDateTime} onChange={value => this._handleChange(field, value)} /> :
            <OneLineEditor
              defaultValue={val || ''}
              onChange={value => this._handleChange(field, value)}
            />
          }
        </label>
      </div>
    );
  }

  render() {
    const { activeCookeJar } = this.props;
    const { cookie } = this.state;
    const checkFields = ['secure', 'httpOnly'];
    return (
      <Modal ref={this._setModalRef} {...this.props}>
        <ModalHeader>Edit Cookie</ModalHeader>
        <ModalBody className="cookie-modify">
          {activeCookeJar && cookie && (
            <Tabs>
              <TabList>
                <Tab tabIndex="-1">
                  <button>Friendly</button>
                </Tab>
                <Tab tabIndex="-1">
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
                  {this._renderInputField('expires')}
                </div>
                <div className="pad no-pad-top cookie-modify__checkboxes row-around txt-lg">
                  {checkFields.map((field, i) => {
                    // @ts-expect-error -- mapping unsoundness
                    const checked = !!cookie[field];
                    return (
                      <label key={i}>
                        {capitalize(field)}
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
                  <label>
                    Raw Cookie String
                    <input
                      type="text"
                      onChange={this._handleChangeRawValue}
                      defaultValue={this._getRawCookieString()}
                    />
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

const mapStateToProps = (state: RootState) => ({
  activeCookeJar: selectActiveCookieJar(state),
});

export const CookieModifyModal = connect(
  mapStateToProps,
  null,
  null,
  { forwardRef: true },
)(UnconnectedCookieModifyModal);
