import clone from 'clone';
import { isValid } from 'date-fns';
import { cookieToString } from 'insomnia-cookies';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import * as toughCookie from 'tough-cookie';

import { capitalize } from '../../../common/misc';
import * as models from '../../../models';
import type { Cookie } from '../../../models/cookie-jar';
import { selectActiveCookieJar } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { OneLineEditor } from '../codemirror/one-line-editor';
export interface CookieModifyModalOptions {
  cookie: Cookie;
}
export interface CookieModifyModalHandle {
  show: (options: CookieModifyModalOptions) => void;
  hide: () => void;
}
export const CookieModifyModal = forwardRef<CookieModifyModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [cookie, setCookie] = useState<Cookie | null>(null);
  const activeCookieJar = useSelector(selectActiveCookieJar);
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({ cookie }) => {
      if (!activeCookieJar?.cookies.find(c => c.id === cookie.id)) {
        // Cookie not found in jar
        return;
      }
      setCookie(cookie);
      modalRef.current?.show();
    },
  }), [activeCookieJar?.cookies]);

  async function handleCookieUpdate(nextCookie: any) {
    if (!cookie || !activeCookieJar) {
      // We don't have a cookie to edit
      return;
    }
    const newcookie = clone(nextCookie);
    // transform to Date object or fallback to null
    let dateFormat = null;
    if (newcookie.expires && isValid(new Date(newcookie.expires))) {
      dateFormat = new Date(newcookie.expires);
    }
    newcookie.expires = dateFormat;
    // Clone so we don't modify the original
    const cookieJar = clone(activeCookieJar);
    const index = cookieJar.cookies.findIndex(c => c.id === cookie.id);
    if (index < 0) {
      console.warn(`Could not find cookie with id=${cookie.id} to edit`);
      return;
    }
    cookieJar.cookies = [...cookieJar.cookies.slice(0, index), cookie, ...cookieJar.cookies.slice(index + 1)];
    setCookie(cookie);
    models.cookieJar.update(cookieJar);
  }

  const renderInputField = (field: keyof Cookie) => {
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
            <input type="datetime-local" defaultValue={localDateTime} onChange={value => handleChange(field, value)} /> :
            <OneLineEditor
              defaultValue={val || ''}
              onChange={value => handleChange(field, value)}
            />
          }
        </label>
      </div>
    );
  };

  async function handleChange(field: string, eventOrValue: string | React.ChangeEvent<HTMLInputElement>) {
    let value;
    if (typeof eventOrValue === 'string') {
      value = eventOrValue.trim();
    } else if (eventOrValue.target instanceof HTMLInputElement) {
      if (eventOrValue.target.type === 'checkbox') {
        value = eventOrValue.target.checked;
      } else {
        value = eventOrValue.target.value.trim();
      }
    }
    const newCookie = Object.assign({}, cookie, { [field]: value });
    await handleCookieUpdate(newCookie);
    setCookie(newCookie);
  }

  let defaultValue;
  if (!cookie) {
    defaultValue = '';
  }
  try {
    defaultValue = cookieToString(toughCookie.Cookie.fromJSON(JSON.stringify(cookie)));
  } catch (err) {
    console.warn('Failed to parse cookie string', err);
    defaultValue = '';
  }
  return (
    <Modal ref={modalRef}>
      <ModalHeader>Edit Cookie</ModalHeader>
      <ModalBody className="cookie-modify">
        {activeCookieJar && cookie && (
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
                  {renderInputField('key')}
                  {renderInputField('value')}
                </div>
                <div className="form-row">
                  {renderInputField('domain')}
                  {renderInputField('path')}
                </div>
                {renderInputField('expires')}
              </div>
              <div className="pad no-pad-top cookie-modify__checkboxes row-around txt-lg">
                {['secure', 'httpOnly'].map((field, i) => {
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
                        onChange={e => handleChange(field, e)}
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
                    onChange={event => {
                      try {
                        // NOTE: Perform toJSON so we have a plain JS object instead of Cookie instance
                        const parsed = toughCookie.Cookie.parse(event.target.value)?.toJSON();
                        if (parsed) {
                          // Make sure cookie has an id
                          parsed.id = cookie.id;
                          handleCookieUpdate(parsed);
                        }
                      } catch (err) {
                        console.warn(`Failed to parse cookie string "${event.target.value}"`, err);
                        return;
                      }
                    }}
                    defaultValue={defaultValue}
                  />
                </label>
              </div>
            </TabPanel>
          </Tabs>
        )}
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
CookieModifyModal.displayName = 'CookieModifyModal';
