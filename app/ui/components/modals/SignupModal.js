import React, {Component} from 'react';

import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';
import {getModal} from './index';
import LoginModal from './LoginModal';
import * as sync from '../../../backend/sync';
import {trackEvent} from '../../../backend/ganalytics';

class SignupModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      step: 1,
      error: '',
      loading: false
    }
  }

  async _handleSignup (e) {
    e.preventDefault();
    this.setState({error: '', loading: true});

    const email = this._emailInput.value;
    const password = this._passwordInput.value;
    const firstName = this._nameFirstInput.value;
    const lastName = this._nameLastInput.value;

    try {
      await session.signup(firstName, lastName, email, password);
      this.setState({step: 2, loading: false});
      sync.initSync();
    } catch (e) {
      this.setState({error: e.message, loading: false});
    }
  }

  _handleLogin (e) {
    e.preventDefault();

    this.modal.hide();
    getModal(LoginModal).show();
    trackEvent('Auth', 'Signup', 'Switch');
  }

  show () {
    this.setState({step: 1});
    this.modal.show();
    setTimeout(() => this._nameFirstInput.focus(), 200);
  }

  render () {
    if (this.state.step === 1) {
      return (
        <Modal ref={m => this.modal = m} {...this.props}>
          <form onSubmit={this._handleSignup.bind(this)}>
            <ModalHeader>Sign Up For a New Account</ModalHeader>
            <ModalBody className="pad">
              <label htmlFor="signup-name-first">First Name</label>
              <div className="form-control form-control--outlined">
                <input type="text"
                       required="required"
                       id="signup-name-first"
                       name="signup-name-first"
                       placeholder="Jane"
                       ref={n => this._nameFirstInput = n}/>
              </div>
              <label htmlFor="signup-name-last">Last Name</label>
              <div className="form-control form-control--outlined">
                <input type="text"
                       id="signup-name-last"
                       name="signup-name-last"
                       placeholder="Doe"
                       ref={n => this._nameLastInput = n}/>
              </div>
              <label htmlFor="signup-email">Email Address</label>
              <div className="form-control form-control--outlined">
                <input type="email"
                       required="required"
                       id="signup-email"
                       name="signup-email"
                       placeholder="me@mydomain.com"
                       ref={n => this._emailInput = n}/>
              </div>
              <label htmlFor="signup-password">Password <span
                className="faint">(minimum 6 characters)</span></label>
              <div className="form-control form-control--outlined">
                <input type="password"
                       required="required"
                       pattern=".{6,}"
                       id="signup-password"
                       name="signup-password"
                       placeholder="•••••••••••••"
                       ref={n => this._passwordInput = n}/>
              </div>
              <p className="italic faint pad-top-sm">
                NOTE: your password is used for end-to-end encryption so try not
                to lose it
              </p>
              {this.state.error ? (
                <div className="danger pad-top">** {this.state.error}</div>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <div className="margin-left">
                Already have an account?
                {" "}
                <a href="#" onClick={this._handleLogin.bind(this)}>Login</a>
              </div>
              <button type="submit" className="btn">
                {this.state.loading ? <i className="fa fa-spin fa-refresh margin-right-sm"></i> : null}
                Create Account
              </button>
            </ModalFooter>
          </form>
        </Modal>
      )
    } else {
      return (
        <Modal ref={m => this.modal = m} {...this.props}>
          <ModalHeader>Account Created</ModalHeader>
          <ModalBody className="pad">
            <h1>Please verify your account</h1>
            <p>
              A verification email has been sent to your email address. Once
              you have received it, you may login.
            </p>
          </ModalBody>
          <ModalFooter>
            <button type="submit"
                    className="btn"
                    onClick={e => this._handleLogin(e)}>
              Proceed to Login
            </button>
          </ModalFooter>
        </Modal>
      )
    }
  }
}

SignupModal.propTypes = {};
export default SignupModal;
