import React, { type FC, useEffect, useRef, useState } from 'react';

import type { OAuth2AuthorizationStatusType } from '../../../network/o-auth-2/constants';
import { invariant } from '../../../utils/invariant';
import uiEventBus, { OAUTH2_AUTHORIZATION_STATUS_CHANGE } from '../../eventBus';
import { Modal, type ModalHandle } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { Icon } from '../icon';

export const OAuthAuthorizationStatusModal: FC = () => {
  const [status, setStatus] = useState<OAuth2AuthorizationStatusType>('none');
  const [authCodeUrlStr, setAuthCodeUrlStr] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const handleStatusChange = ({
      status: newStatus,
      authCodeUrlStr,
    }: {
      status: OAuth2AuthorizationStatusType;
      authCodeUrlStr?: string;
    }) => {
      setStatus(newStatus);
      setAuthCodeUrlStr(authCodeUrlStr);
    };
    uiEventBus.on(OAUTH2_AUTHORIZATION_STATUS_CHANGE, handleStatusChange);
    return () => {
      uiEventBus.off(OAUTH2_AUTHORIZATION_STATUS_CHANGE, handleStatusChange);
    };
  }, []);

  const modalRef = useRef<ModalHandle>(null);
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  useEffect(() => {
    if (status === 'none') {
      modalRef.current?.hide();
    } else if (status === 'getting_code') {
      modalRef.current?.show();
      setSubmitting(false);
    }
  }, [status]);

  return (
    <Modal
      centered
      ref={modalRef}
      onHide={() => {
        window.main.cancelAuthorizationInDefaultBrowser('Canceled by user.');
      }}
    >
      <ModalHeader>OAuth 2.0 Authorization</ModalHeader>
      <ModalBody>
        {status === 'none' && 'Not in Authorization'}
        {status === 'getting_code' && (
          <>
            <p className="text-[rgba(var(--color-font-rgb),0.8))] text-start">
              See your browser to finish authorization, if the browser didn’t open automatically, copy and paste this
              URL into your browser to authorize.
            </p>
            <div className="form-control form-control--outlined no-pad-top flex">
              <input type="text" value={authCodeUrlStr} style={{ marginRight: 'var(--padding-sm)' }} readOnly />
              <button
                className="btn btn--super-compact btn--outlined"
                onClick={() => {
                  window.clipboard.writeText(authCodeUrlStr as string);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--padding-xs)',
                }}
              >
                <i className="fa fa-clipboard" aria-hidden="true" />
                Copy
              </button>
            </div>
            <p className="text-[rgba(var(--color-font-rgb),0.8))] text-start">
              If the Insomnia app doesn’t open automatically after you complete the authorization in your browser,
              please copy the full redirect URL showed in the redirect page and paste it below.
            </p>
            <form
              onSubmit={e => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);

                const url = data.get('url');
                invariant(typeof url === 'string', 'Expected code to be a string');
                if (url.length === 0) {
                  return;
                }
                setSubmitting(true);
                window.main.onDefaultBrowserOAuthRedirect({
                  url,
                });
              }}
            >
              <div className="form-control form-control--outlined no-pad-top" style={{ display: 'flex' }}>
                <input type="text" name="url" style={{ marginRight: 'var(--padding-sm)' }} />
                <button
                  className="btn btn--super-compact btn--outlined"
                  type="submit"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--padding-xs)',
                  }}
                  disabled={submitting}
                >
                  <Icon icon={submitting ? 'spinner' : 'sign-in'} className={submitting ? 'animate-spin' : ''} />
                  Proceed
                </button>
              </div>
            </form>
          </>
        )}
        {status === 'getting_token' && 'Getting access token ...'}
      </ModalBody>
    </Modal>
  );
};
