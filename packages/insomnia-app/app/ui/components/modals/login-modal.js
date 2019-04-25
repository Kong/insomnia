import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import * as sync from '../../../sync-legacy';
import * as session from '../../../account/session';

@autobind
class LoginModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      error: '',
      title: '',
      message: '',
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }

  _setPasswordInputRef(n) {
    this._passwordInput = n;
  }

  _setEmailInputRef(n) {
    this._emailInput = n;
  }

  async _handleLogin(e) {
    e.preventDefault();
    this.setState({ error: '', loading: true });

    const email = this._emailInput.value;
    const password = this._passwordInput.value;

    try {
      await session.login(email, password);

      // Clear all existing sync data that might be there and enable sync
      await sync.resetLocalData();
      await sync.doInitialSync();
      this.hide();
    } catch (e) {
      this.setState({ error: e.message, loading: false });
    }
  }

  show(options = {}) {
    const { title, message } = options;
    this.setState({ error: '', loading: false, title, message });
    this.modal.show();
    setTimeout(() => this._emailInput.focus(), 100);
  }

  hide() {
    this.modal.hide();
  }

  render() {
    const { title, message, loading, error } = this.state;
    return (
      <form onSubmit={this._handleLogin}>
        <Modal ref={this._setModalRef} {...this.props}>
          <ModalHeader>{title || 'Login to Your Account'}</ModalHeader>
          <ModalBody className="pad">
            {message ? <p className="notice info">{message}</p> : null}
            <div className="form-control form-control--outlined no-pad-top">
              <label>
                Email
                <input
                  type="email"
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
              Don't have an account yet? <Link href="https://insomnia.rest/app/">Signup</Link>
            </div>
            <button type="submit" className="btn">
              {loading ? <i className="fa fa-spin fa-refresh margin-right-sm" /> : null}
              Login
            </button>
          </ModalFooter>
        </Modal>
      </form>
    );
  }
}

export default LoginModal;
