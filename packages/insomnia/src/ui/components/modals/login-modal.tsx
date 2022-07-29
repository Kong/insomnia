import { decodeBase64, encodeBase64 } from '@getinsomnia/api-client/base64';
import { keyPair, open } from '@getinsomnia/api-client/sealedbox';
import * as Sentry from '@sentry/electron';
import { clipboard } from 'electron';
import React, { Dispatch, FormEvent, forwardRef, memo, RefObject, SetStateAction, useCallback, useImperativeHandle, useRef, useState } from 'react';

import * as session from '../../../account/session';
import { getAppWebsiteBaseURL } from '../../../common/constants';
import { clickLink } from '../../../common/electron-helpers';
import { type ModalHandle, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from './index';

/**
 * Keypair used for the login handshake.
 * This keypair can be re-used for the entire session.
 */
const sessionKeyPair = keyPair();

/**
 * Global of latest modal instance, or null if none exist.
 */
export let currentLoginModalHandle: LoginModalHandle | null = null;

session.onLoginLogout(() => {
  currentLoginModalHandle?.hide();
});

interface State {
  state: 'ready' | 'error' | 'token-entry' | 'loading-session';
  url: string;
  error: string;
}

interface Options {
  title: string;
  message: string;
  reauth: boolean;
}

interface AuthBox {
  token: string;
  key: string;
}

export class LoginModalHandle {
  constructor(
    private readonly modalRef: RefObject<ModalHandle>,
    private readonly setState: Dispatch<SetStateAction<State & Options>>,
  ) {}

  private async getLoginUrl() {
    const loginKey = await encodeBase64(sessionKeyPair.publicKey);
    return `${getAppWebsiteBaseURL()}/app/auth-app/?loginKey=${encodeURIComponent(loginKey)}`;
  }

  async submitAuthCode(code: string) {
    this.setState(state => ({ ...state, state: 'loading-session' }));
    try {
      const rawBox = await decodeBase64(code.trim());
      const boxData = open(rawBox, sessionKeyPair.publicKey, sessionKeyPair.secretKey);
      if (!boxData) {
        this.setState(state => ({ ...state, state: 'error', error: 'Invalid authentication code.' }));
        return;
      }
      const decoder = new TextDecoder();
      const box: AuthBox = JSON.parse(decoder.decode(boxData));
      await session.absorbKey(box.token, box.key);
    } catch (e) {
      Sentry.captureException(e);
      this.setState(state => ({ ...state, state: 'error', error: `Error loading credentials: ${String(e)}` }));
    }
  }

  async show(options: Partial<Options> = {}) {
    const { title, message, reauth } = options;
    const url = await this.getLoginUrl();
    this.setState({
      error: '',
      state: 'ready',
      title: title ?? '',
      message: message ?? '',
      reauth: reauth ?? false,
      url,
    });

    this.modalRef.current?.show();

    if (!reauth) {
      clickLink(url);
    }
  }

  hide() {
    this.modalRef.current?.hide();
  }
}

export const LoginModal = memo(forwardRef<LoginModalHandle, {}>(function LoginModal({ ...props }, ref) {
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

  useImperativeHandle(ref, () => {
    currentLoginModalHandle = new LoginModalHandle(modalRef, setState);
    return currentLoginModalHandle;
  }, []);

  const reset = useCallback(() => {
    setState(state => ({ ...state, state: 'ready', error: '' }));
  }, []);

  const goToTokenEntry = useCallback(() => {
    setState(state => ({ ...state, state: 'token-entry' }));
  }, []);

  const submitToken = useCallback((event: FormEvent) => {
    event.preventDefault();
    currentLoginModalHandle?.submitAuthCode(tokenInputRef.current?.value ?? '');
  }, []);

  const copyUrl = useCallback(() => {
    clipboard.writeText(state.url);
  }, [state.url]);

  const openUrl = useCallback(() => {
    clickLink(state.url);
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
}));

LoginModal.displayName = 'LoginModal';

export const showLoginModal = () => showModal(LoginModalHandle);
