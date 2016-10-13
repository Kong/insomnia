import React, {Component} from 'react';

import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';
import {getModal} from './index';
import LoginModal from './LoginModal';

class SignupModal extends Component {
  async _handleSignup (e) {
    e.preventDefault();

    const email = this._emailInput.value;
    const password = this._passwordInput.value;

    try {
      await session.signupAndLogin(email, password);
      this.modal.hide();
    } catch (e) {
      // TODO: Handle failures
      console.warn('Failed to signup', e)
    }
  }

  _handleLogin (e) {
    e.preventDefault();

    this.modal.hide();
    getModal(LoginModal).show()
  }

  show () {
    this.modal.show();
    setTimeout(() => this._emailInput.focus(), 200);
  }

  render () {
    return (
      <form onSubmit={this._handleSignup.bind(this)}>
        <Modal ref={m => this.modal = m} {...this.props}>
          <ModalHeader>Sign Up For a New Account</ModalHeader>
          <ModalBody className="pad changelog">
            <label htmlFor="login-email">Your Email Address</label>
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
              Sign Up
            </button>
            <div className="pad">
              Already have an account?
              {" "}
              <a href="#" onClick={this._handleLogin.bind(this)}>Login</a>
            </div>
          </ModalFooter>
        </Modal>
      </form>
    )
  }
}

SignupModal.propTypes = {};

export default SignupModal;
