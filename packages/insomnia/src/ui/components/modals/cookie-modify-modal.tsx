import clone from 'clone';
import { isValid } from 'date-fns';
import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useRouteLoaderData } from 'react-router-dom';
import { useFetcher, useParams } from 'react-router-dom';
import { Cookie as ToughCookie } from 'tough-cookie';

import { cookieToString } from '../../../common/cookies';
import type { Cookie, CookieJar } from '../../../models/cookie-jar';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { OneLineEditor } from '../codemirror/one-line-editor';
export interface CookieModifyModalOptions {
  cookie: Cookie;
}

export const CookieModifyModal = ((props: ModalProps & CookieModifyModalOptions) => {
  const modalRef = useRef<ModalHandle>(null);
  const [cookie, setCookie] = useState<Cookie | null>(props.cookie);
  const { activeCookieJar } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const updateCookieJarFetcher = useFetcher<CookieJar>();
  useEffect(() => {
    modalRef.current?.show();
  }, []);
  const updateCookieJar = async (cookieJarId: string, patch: CookieJar) => {
    updateCookieJarFetcher.submit(JSON.stringify({ patch, cookieJarId }), {
      encType: 'application/json',
      method: 'post',
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/cookieJar/update`,
    });
  };
  const handleCookieUpdate = async (nextCookie: any) => {
    if (!cookie) {
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
    const index = activeCookieJar.cookies.findIndex(c => c.id === cookie.id);
    if (index < 0) {
      console.warn(`Could not find cookie with id=${cookie.id} to edit`);
      return;
    }
    cookieJar.cookies = [...cookieJar.cookies.slice(0, index), newcookie, ...cookieJar.cookies.slice(index + 1)];
    updateCookieJar(cookieJar._id, cookieJar);
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
      const c = ToughCookie.fromJSON(JSON.stringify(cookie));
      rawDefaultValue = c ? cookieToString(c) : '';
    } catch (err) {
      console.warn('Failed to parse cookie string', err);
      rawDefaultValue = '';
    }
  }
  return (
    <OverlayContainer>
      <Modal ref={modalRef} onHide={props.onHide}>
        <ModalHeader>Edit Cookie</ModalHeader>
        <ModalBody className="cookie-modify">
          {activeCookieJar && cookie && (
            <Tabs aria-label="Cookie modify tabs">
              <TabItem key="friendly" title="Friendly">
                <PanelContainer className="pad">
                  <div className="form-row">
                    <div className="form-control form-control--outlined">
                      <label data-testid="CookieKey">
                        Key
                        <OneLineEditor
                          id="cookie-key"
                          defaultValue={(cookie && cookie.key || '').toString()}
                          onChange={value => handleCookieUpdate(Object.assign({}, cookie, { key: value.trim() }))}
                        />
                      </label>
                    </div>
                    <div className="form-control form-control--outlined">
                      <label data-testid="CookieValue">
                        Value
                        <OneLineEditor
                          id="cookie-value"
                          defaultValue={(cookie && cookie.value || '').toString()}
                          onChange={value => handleCookieUpdate(Object.assign({}, cookie, { value: value.trim() }))}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-control form-control--outlined">
                      <label data-testid="CookieDomain">
                        Domain
                        <OneLineEditor
                          id="cookie-domain"
                          defaultValue={(cookie && cookie.domain || '').toString()}
                          onChange={value => handleCookieUpdate(Object.assign({}, cookie, { domain: value.trim() }))}
                        />
                      </label>
                    </div>
                    <div className="form-control form-control--outlined">
                      <label data-testid="CookiePath">
                        Path
                        <OneLineEditor
                          id="cookie-path"
                          defaultValue={(cookie && cookie.path || '').toString()}
                          onChange={value => handleCookieUpdate(Object.assign({}, cookie, { path: value.trim() }))}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="form-control form-control--outlined">
                    <label data-testid="CookieExpires">
                      Expires
                      <input type="datetime-local" defaultValue={localDateTime} onChange={event => handleCookieUpdate(Object.assign({}, cookie, { expires: event.target.value }))} />
                    </label>
                  </div>
                </PanelContainer>
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
              </TabItem>
              <TabItem key="raw" title="Raw">
                <PanelContainer className="pad">
                  <div className="form-control form-control--outlined">
                    <label>
                      Raw Cookie String
                      <input
                        type="text"
                        onChange={event => {
                          try {
                            // NOTE: Perform toJSON so we have a plain JS object instead of Cookie instance
                            const parsed = ToughCookie.parse(event.target.value)?.toJSON();
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
                </PanelContainer>
              </TabItem>
            </Tabs>
          )}
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={() => modalRef.current?.hide()}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
});
