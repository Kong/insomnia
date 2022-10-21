import clone from 'clone';
import { isValid } from 'date-fns';
import { cookieToString } from 'insomnia-cookies';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import * as toughCookie from 'tough-cookie';

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
        return;
      }
      setCookie(cookie);
      modalRef.current?.show();
    },
  }), [activeCookieJar?.cookies]);

  const handleCookieUpdate = async (nextCookie: any) => {
    if (!cookie || !activeCookieJar) {
      return;
    }
    const newcookie = clone(nextCookie);
    // transform to Date object or fallback to null
    let dateFormat = null;
    if (newcookie.expires && isValid(new Date(newcookie.expires))) {
      dateFormat = new Date(newcookie.expires);
    }
    newcookie.expires = dateFormat;
    setCookie(newcookie);

    // Clone so we don't modify the original
    const cookieJar = clone(activeCookieJar);
    const index = cookieJar.cookies.findIndex(c => c.id === cookie.id);
    if (index < 0) {
      console.warn(`Could not find cookie with id=${cookie.id} to edit`);
      return;
    }
    cookieJar.cookies = [...cookieJar.cookies.slice(0, index), newcookie, ...cookieJar.cookies.slice(index + 1)];
    models.cookieJar.update(cookieJar);
  };

  let localDateTime;
  if (cookie && cookie.expires && isValid(new Date(cookie.expires))) {
    localDateTime = new Date(cookie.expires).toISOString().slice(0, 16);
  }
  let rawDefaultValue;
  if (!cookie) {
    rawDefaultValue = '';
  } else {
    try {
      rawDefaultValue = cookieToString(toughCookie.Cookie.fromJSON(JSON.stringify(cookie)));
    } catch (err) {
      console.warn('Failed to parse cookie string', err);
      rawDefaultValue = '';
    }
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
                  <div className="form-control form-control--outlined">
                    <label>
                      Key
                      <OneLineEditor
                        defaultValue={(cookie && cookie.key || '').toString()}
                        onChange={value => handleCookieUpdate(Object.assign({}, cookie, { key: value.trim() }))}
                      />
                    </label>
                  </div>
                  <div className="form-control form-control--outlined">
                    <label>
                      Value
                      <OneLineEditor
                        defaultValue={(cookie && cookie.value || '').toString()}
                        onChange={value => handleCookieUpdate(Object.assign({}, cookie, { value: value.trim() }))}
                      />
                    </label>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-control form-control--outlined">
                    <label>
                      Domain
                      <OneLineEditor
                        defaultValue={(cookie && cookie.domain || '').toString()}
                        onChange={value => handleCookieUpdate(Object.assign({}, cookie, { domain: value.trim() }))}
                      />
                    </label>
                  </div>
                  <div className="form-control form-control--outlined">
                    <label>
                      Path
                      <OneLineEditor
                        defaultValue={(cookie && cookie.path || '').toString()}
                        onChange={value => handleCookieUpdate(Object.assign({}, cookie, { path: value.trim() }))}
                      />
                    </label>
                  </div>
                </div>
                <div className="form-control form-control--outlined">
                  <label>
                    Expires
                    <input type="datetime-local" defaultValue={localDateTime} onChange={event => handleCookieUpdate(Object.assign({}, cookie, { expires: event.target.value }))} />
                  </label>
                </div>
              </div>
              <div className="pad no-pad-top cookie-modify__checkboxes row-around txt-lg">
                <label>
                  Secure
                  <input
                    className="space-left"
                    type="checkbox"
                    name="secure"
                    defaultChecked={cookie.secure || false}
                    onChange={event => handleCookieUpdate(Object.assign({}, cookie, { secure: event.target.checked }))}
                  />
                </label>
                <label>
                  httpOnly
                  <input
                    className="space-left"
                    type="checkbox"
                    name="httpOnly"
                    defaultChecked={cookie.httpOnly || false}
                    onChange={event => handleCookieUpdate(Object.assign({}, cookie, { httpOnly: event.target.checked }))}
                  />
                </label>
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
                    defaultValue={rawDefaultValue}
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
