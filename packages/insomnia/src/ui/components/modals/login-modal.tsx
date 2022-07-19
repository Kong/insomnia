import { decodeBase64, encodeBase64 } from '@getinsomnia/api-client/base64';
import { keyPair, open } from '@getinsomnia/api-client/sealedbox';
import * as Sentry from '@sentry/electron/renderer';
import React, { Dispatch, FormEvent, forwardRef, MutableRefObject, RefObject, SetStateAction, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import * as session from '../../../account/session';
import { getAppWebsiteBaseURL } from '../../../common/constants';
import { clickLink } from '../../../common/electron-helpers';
import { Modal } from '../base/modal';
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

interface State {
  state: 'ready' | 'error' | 'token-entry' | 'loading-session' | 'done';
  url: string;
  error: string;
}

interface Options {
  title: string;
  message: string;
}

interface AuthBox {
  token: string;
  key: string;
}

export class LoginModalHandle {
  constructor(
    private readonly modalRef: RefObject<Modal>,
    private readonly stateRef: Readonly<MutableRefObject<State & Options>>,
    private readonly setState: Dispatch<SetStateAction<State & Options>>,
  ) {}

  private async getLoginUrl() {
    const loginKey = await encodeBase64(sessionKeyPair.publicKey);
    return `${getAppWebsiteBaseURL()}/app/auth-app/?loginKey=${encodeURIComponent(loginKey)}`;
  }

  async submitAuthCode(code: string) {
    this.setState({ ...this.stateRef.current, state: 'loading-session' });
    try {
      const rawBox = await decodeBase64(code.trim());
      const boxData = open(rawBox, sessionKeyPair.publicKey, sessionKeyPair.secretKey);
      if (!boxData) {
        this.setState({ ...this.stateRef.current, state: 'error', error: 'Invalid authentication code.' });
        return;
      }
      const decoder = new TextDecoder();
      const box: AuthBox = JSON.parse(decoder.decode(boxData));
      await session.absorbKey(box.token, box.key);
      this.setState({ ...this.stateRef.current, state: 'done' });
    } catch (e) {
      Sentry.captureException(e);
      this.setState({ ...this.stateRef.current, state: 'error', error: `Error loading credentials: ${String(e)}` });
    }
  }

  async show(options: Partial<Options> = {}) {
    const { title, message } = options;
    const url = await this.getLoginUrl();
    this.setState({
      error: '',
      state: 'ready',
      title: title ?? '',
      message: message ?? '',
      url,
    });
    this.modalRef.current?.show();
    clickLink(url);
  }

  hide() {
    this.modalRef.current?.hide();
  }
}

function useStateRef<T>(state: T): Readonly<MutableRefObject<T>> {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  return stateRef;
}

export const LoginModal = forwardRef<LoginModalHandle, {}>(function LoginModal({ ...props }, ref) {
  const modalRef = useRef<Modal>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<State & Options>({
    state: 'ready',
    error: '',
    title: '',
    message: '',
    url: '',
  });

  const stateRef = useStateRef(state);

  useImperativeHandle(ref, () => {
    currentLoginModalHandle = new LoginModalHandle(modalRef, stateRef, setState);
    return currentLoginModalHandle;
  }, [stateRef]);

  // Clean up global login modal handle on unmount.
  useEffect(() => {
    return () => {
      currentLoginModalHandle = null;
    };
  }, []);

  const reset = useCallback(() => {
    setState({ ...state, state: 'ready', error: '' });
  }, [state]);

  const goToTokenEntry = useCallback(() => {
    setState({ ...state, state: 'token-entry' });
  }, [state]);

  const submitToken = useCallback((event: FormEvent) => {
    event.preventDefault();
    currentLoginModalHandle?.submitAuthCode(tokenInputRef.current?.value ?? '');
  }, []);

  const copyUrl = useCallback(() => {
    urlInputRef.current?.select();
    document.execCommand('copy');
  }, []);

  const renderBody = () => {
    switch (state.state) {
      case 'ready':
        return <>
          <b>Please login via your web browser.</b>
          <p>
            A new page should have opened in your default web browser.
            To continue, please login via the browser.
          </p>
          <p>
            If it did not open, copy and paste the following URL into your browser:
          </p>
          <div className="form-control form-control--outlined no-pad-top" style={{ 'display': 'flex' }} data-testid="LoginModal__url">
            <input
              type="text"
              value={state.url}
              style={{ 'marginRight': 'var(--padding-sm)' }}
              ref={urlInputRef}
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
          <div className="form-control form-control--outlined no-pad-top" style={{ 'display': 'flex' }}>
            <label>
              Token:
              <input
                type="text"
                ref={tokenInputRef}
                style={{ 'marginRight': 'var(--padding-sm)' }}
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

      case 'done':
        return <div className="notice surprise">Success! You are now authenticated.</div>;

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
        {state.state === 'ready' ?
          <button className="btn" onClick={goToTokenEntry}>Manually Enter Token</button> : null}
        {state.state === 'done' ?
          <button className="btn" onClick={modalRef.current?.hide}>Close</button> : null}
      </ModalFooter>
    </Modal>
  );
});

LoginModal.displayName = 'LoginModal';

export const showLoginModal = () => showModal(LoginModalHandle);
