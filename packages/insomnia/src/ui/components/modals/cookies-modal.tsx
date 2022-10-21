import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { fuzzyMatch } from '../../../common/misc';
import * as models from '../../../models';
import type { Cookie } from '../../../models/cookie-jar';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { selectActiveCookieJar } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { CookieList } from '../cookie-list';
import { showModal } from '.';
export interface CookiesModalHandle {
  show: () => void;
  hide: () => void;
}
export const CookiesModal = forwardRef<CookiesModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const { handleRender } = useNunjucks();
  const [filter, setFilter] = useState<string>('');
  const [visibleCookieIndexes, setVisibleCookieIndexes] = useState<number[] | null>(null);
  const activeCookieJar = useSelector(selectActiveCookieJar);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: () => {
      modalRef.current?.show();
    },
  }), []);

  const filteredCookies = visibleCookieIndexes ? (activeCookieJar?.cookies || []).filter((_, i) => visibleCookieIndexes.includes(i)) : (activeCookieJar?.cookies || []);
  return (
    <Modal ref={modalRef} wide tall>
      <ModalHeader>Manage Cookies</ModalHeader>
      <ModalBody noScroll>
        {activeCookieJar && (
          <div className="cookie-list">
            <div className="pad">
              <div className="form-control form-control--outlined">
                <label>
                  Filter Cookies
                  <input
                    onChange={async event => {
                      setFilter(event.target.value);
                      const renderedCookies: Cookie[] = [];
                      for (const cookie of (activeCookieJar?.cookies || [])) {
                        try {
                          renderedCookies.push(await handleRender(cookie));
                        } catch (err) {
                          renderedCookies.push(cookie);
                        }
                      }
                      if (!filter) {
                        setVisibleCookieIndexes(null);
                      }
                      const visibleCookieIndexes: number[] = [];
                      renderedCookies.forEach((cookie, i) => {
                        if (fuzzyMatch(filter, JSON.stringify(cookie), { splitSpace: true })) {
                          visibleCookieIndexes.push(i);
                        }
                      });
                      setVisibleCookieIndexes(visibleCookieIndexes);
                    }}
                    type="text"
                    placeholder="insomnia.rest"
                    defaultValue=""
                  />
                </label>
              </div>
            </div>
            <div className="cookie-list__list border-tops pad">
              <CookieList
                cookies={filteredCookies}
                handleDeleteAll={() => {
                  const updated = activeCookieJar;
                  updated.cookies = [];
                  models.cookieJar.update(updated);
                }}
                handleCookieAdd={cookie => {
                  const updated = activeCookieJar;
                  updated.cookies = [cookie, ...activeCookieJar.cookies];
                  models.cookieJar.update(updated);
                }}
                handleCookieDelete={cookie => {
                  const updated = activeCookieJar;
                  updated.cookies = activeCookieJar.cookies.filter(c => c.id !== cookie.id);
                  models.cookieJar.update(updated);
                }}
                // Set the domain to the filter so that it shows up if we're filtering
                newCookieDomainName={filter || 'domain.com'}
              />
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <div className="margin-left faint italic txt-sm">
          * cookies are automatically sent with relevant requests
        </div>
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
CookiesModal.displayName = 'CookiesModal';

export const showCookiesModal = () => showModal(CookiesModal);
