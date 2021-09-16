import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import * as session from '../../../account/session';
import { AUTOBIND_CFG } from '../../../common/constants';
import Link from '../base/link';
import Modal from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from './index';

interface State {
  loading: boolean;
  error: string;
  title: string;
  message: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class LoginModal extends PureComponent<{}, State> {
  state: State = {
    loading: false,
    error: '',
    title: '',
    message: '',
  };

  modal: Modal | null = null;
  _passwordInput: HTMLInputElement | null = null;
  _emailInput: HTMLInputElement | null = null;

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _setPasswordInputRef(n: HTMLInputElement) {
    this._passwordInput = n;
  }

  _setEmailInputRef(n: HTMLInputElement) {
    this._emailInput = n;
  }

  async _handleLogin(e) {
    e.preventDefault();
    this.setState({
      error: '',
      loading: true,
    });
    const email = this._emailInput?.value;
    const password = this._passwordInput?.value;

    try {
      // @ts-expect-error -- TSCONVERSION this needs to explicitly handle the case where email or password is undefined
      await session.login(email, password);
      this.hide();
    } catch (e) {
      this.setState({
        error: e.message,
        loading: false,
      });
    }
  }

  show(options = {}) {
    // @ts-expect-error -- TSCONVERSION
    const { title, message } = options;
    this.setState({
      error: '',
      loading: false,
      title,
      message,
    });
    this.modal?.show();
    setTimeout(() => this._emailInput?.focus(), 100);
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { title, message, loading, error } = this.state;
    return (
      <form onSubmit={this._handleLogin}>
        <Modal ref={this._setModalRef} {...this.props}>
          <ModalHeader>{title || 'Log Into Your Account'}</ModalHeader>
          <ModalBody className="pad">
            {message ? <p className="notice info">{message}</p> : null}
            <div className="form-control form-control--outlined no-pad-top">
              <label>
                Email
                <input
                  type="email"
                  // @ts-expect-error -- TSCONVERSION appears to be genuine
                  required="required"
                  placeholder="me@mydomain.com"
                  ref={this._setEmailInputRef}
                />
              </label>
            </div>
            <div className="form-control form-control--outlined">
              <label>
                Password
                <input
                  type="password"
                  // @ts-expect-error -- TSCONVERSION appears to be genuine
                  required="required"
                  placeholder="•••••••••••••••••"
                  ref={this._setPasswordInputRef}
                />
              </label>
            </div>
            {error ? <div className="danger pad-top">** {error}</div> : null}
          </ModalBody>
          <ModalFooter>
            <div className="margin-left">
              Don't have an account yet? <Link href="https://app.insomnia.rest">Sign Up</Link>
            </div>
            <button type="submit" className="btn">
              {loading ? <i className="fa fa-spin fa-refresh margin-right-sm" /> : null}
              Log In
            </button>
          </ModalFooter>
        </Modal>
      </form>
    );
  }
}

export const showLoginModal = () => showModal(LoginModal);
export default LoginModal;
