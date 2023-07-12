import React, { FormEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import * as session from '../../../account/session';
import { getLoginUrl, submitAuthCode } from '../../auth-session-provider';
import { Modal, type ModalHandle } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from './index';

interface State {
  state: 'ready' | 'error' | 'token-entry' | 'loading-session';
  url: string;
  error: string;
}

interface Options {
  title?: string;
  message?: string;
  reauth?: boolean;
  onHide?: () => void;
}

export interface LoginModalHandle extends ModalHandle {
  show: (options?: Options) => void;
}

export const LoginModal = forwardRef<LoginModalHandle, {}>(function LoginModal({ ...props }, ref) {
  const modalRef = useRef<ModalHandle>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<State & Options>({
    state: 'ready',
    error: '',
    title: '',
    message: '',
    reauth: false,
    url: '',
  });

  useEffect(() => {
    session.onLoginLogout(() => {
      modalRef.current?.hide();
    });
  }, []);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide;
    },
    toggle: () => modalRef.current?.toggle(),
    isOpen: () => Boolean(modalRef.current?.isOpen()),
    show: async (options: Partial<Options> = {}) => {
      const { title, message, reauth } = options;
      const url = await getLoginUrl();
      setState({
        error: '',
        state: 'ready',
        title: title ?? '',
        message: message ?? '',
        reauth: reauth ?? false,
        url,
      });

      modalRef.current?.show();

      if (!reauth) {
        window.main.openInBrowser(url);
      }
    },
  }), []);

  const reset = useCallback(() => {
    setState(state => ({ ...state, state: 'ready', error: '' }));
  }, []);

  const goToTokenEntry = useCallback(() => {
    setState(state => ({ ...state, state: 'token-entry' }));
  }, []);

  const submitToken = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    try {
      await submitAuthCode(tokenInputRef.current?.value ?? '');
    } catch (e) {
      setState(state => ({ ...state, state: 'error', error: e.message }));
    }
  }, []);

  const copyUrl = useCallback(() => {
    window.clipboard.writeText(state.url);
  }, [state.url]);

  const openUrl = useCallback(() => {
    window.main.openInBrowser(state.url);
  }, [state.url]);

  const renderBody = () => {
    switch (state.state) {
      case 'ready':
        return <>
          <b>Please login via your web browser.</b>
          {state.reauth ?
            <>
              <p>
                To continue logging in, click the button and continue in your web browser.
              </p>
              <button className="btn btn--super-compact btn--outlined" onClick={openUrl}>Log In</button>
              <p>
                If it did not open, copy and paste the following URL into your browser:
              </p>
            </>
            :
            <>
              <p>
                A new page should have opened in your default web browser.
                To continue, please login via the browser.
              </p>
              <p>
                If it did not open, copy and paste the following URL into your browser:
              </p>
            </>
          }
          <div className="form-control form-control--outlined no-pad-top" style={{ 'display': 'flex' }} data-testid="LoginModal__url">
            <input
              type="text"
              value={state.url}
              style={{ 'marginRight': 'var(--padding-sm)' }}
              disabled
            />
            <button
              className="btn btn--super-compact btn--outlined"
              onClick={copyUrl}
            >
              Copy URL
            </button>
          </div>
        </>;

      case 'token-entry':
        return <form onSubmit={submitToken}>
          <div
            className="form-control form-control--outlined no-pad-top"
            style={{ 'display': 'flex', 'flexDirection': 'column' }}
          >
            <label>
              Token:
              <input
                type="text"
                ref={tokenInputRef}
                style={{ 'marginRight': 'var(--padding-sm)', width: '100%' }}
              />
            </label>
          </div>
          <button type="submit" className="btn btn--super-compact btn--outlined">
            Submit
          </button>
        </form>;

      case 'loading-session':
        return <p>Loading...</p>;

      case 'error':
        return <div className="notice error">An error occurred: {state.error}</div>;

      default:
        return <div className="notice error">Unknown state.</div>;
    }
  };

  return (
    <Modal ref={modalRef} {...props}>
      <ModalHeader>{state.title || 'Log Into Your Account'}</ModalHeader>
      <ModalBody className="pad">
        {state.message ? <p className="notice info">{state.message}</p> : null}
        {renderBody()}
      </ModalBody>
      <ModalFooter>
        {state.state === 'error' ?
          <button className="btn" onClick={reset}>Retry</button> : null}
        {state.state === 'ready' && state.reauth ?
          <button className="btn" onClick={session.logout}>Log Out</button> : null}
        {state.state === 'ready' ?
          <button className="btn" onClick={goToTokenEntry}>Manually Enter Token</button> : null}
      </ModalFooter>
    </Modal>
  );
});

LoginModal.displayName = 'LoginModal';

export const showLoginModal = () => showModal(LoginModal);
