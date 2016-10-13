import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';
import {getModal} from './index';
import SignupModal from './SignupModal';

class LoginModal extends Component {
  async _handleLogin (e) {
    e.preventDefault();

    const email = this._emailInput.value;
    const password = this._passwordInput.value;

    try {
      await session.login(email, password);
      this.modal.hide();
    } catch (e) {
      // TODO: Handle failures
      console.warn('Failed to login', e)
    }
  }

  _handleSignup (e) {
    e.preventDefault();

    this.modal.hide();
    getModal(SignupModal).show()
  }

  show () {
    this.modal.show();
    setTimeout(() => this._emailInput.focus(), 100);
  }

  render () {
    return (
      <form onSubmit={this._handleLogin.bind(this)}>
        <Modal ref={m => this.modal = m} {...this.props}>
          <ModalHeader>Login to Your Account</ModalHeader>
          <ModalBody className="pad changelog">
            <label htmlFor="login-email">Email</label>
            <div className="form-control form-control--outlined">
              <input type="email"
                     required="required"
                     id="login-email"
                     name="email"
                     placeholder="me@mydomain.com"
                     ref={n => this._emailInput = n}/>
            </div>
            <label htmlFor="login-password">Password</label>
            <div className="form-control form-control--outlined">
              <input type="password"
                     required="required"
                     id="login-password"
                     name="password"
                     placeholder="•••••••••••••"
                     ref={n => this._passwordInput = n}/>
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="submit" className="pull-right btn">
              Login
            </button>
            <div className="pad">
              Don't have an account yet?
              {" "}
              <a href="#" onClick={this._handleSignup.bind(this)}>Signup</a>
            </div>
          </ModalFooter>
        </Modal>
      </form>
    )
  }
}

LoginModal.propTypes = {};

export default LoginModal;
