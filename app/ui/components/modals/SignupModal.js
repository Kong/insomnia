import React, {Component} from 'react';
import classnames from 'classnames';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../sync/session';
import {showModal} from './index';
import LoginModal from './LoginModal';
import * as sync from '../../../sync';
import {trackEvent} from '../../../analytics';

const STEP_BASIC_INFO = 'basic';
const STEP_CONFIRM_PASSWORD = 'confirm';
const STEP_LOGIN_INFO = 'done';

class SignupModal extends Component {
  state = {
    step: STEP_BASIC_INFO,
    error: '',
    loading: false
  };

  async _handleSignup (e) {
    e.preventDefault();

    if (this.state.step === STEP_BASIC_INFO) {
      this.setState({step: STEP_CONFIRM_PASSWORD});
      return;
    }

    this.setState({error: '', loading: true});

    const email = this._emailInput.value;
    const password = this._passwordInput.value;
    const firstName = this._nameFirstInput.value;
    const lastName = this._nameLastInput.value;

    try {
      await session.signup(firstName, lastName, email, password);
      this.setState({step: STEP_LOGIN_INFO, loading: false});
      sync.init();
    } catch (e) {
      this.setState({error: e.message, loading: false});
    }
  }

  _handleLogin (e) {
    e.preventDefault();

    this.modal.hide();
    showModal(LoginModal, {});
    trackEvent('Signup', 'Switch to Login');
  }

  _checkPasswordsMatch () {
    if (this._passwordInput.value !== this._passwordConfirmInput.value) {
      this._passwordConfirmInput.setCustomValidity('Password didn\'t match')
    } else {
      this._passwordConfirmInput.setCustomValidity('')
    }
  }

  show () {
    this.setState({step: STEP_BASIC_INFO, loading: false, error: ''});
    this.modal.show();
    setTimeout(() => this._nameFirstInput.focus(), 200);
  }

  render () {
    const {step} = this.state;

    let inner = null;
    if (step === STEP_BASIC_INFO || step === STEP_CONFIRM_PASSWORD) {
      inner = [
        <ModalHeader key="header">Sign Up For a New Account</ModalHeader>,
        <ModalBody key="body" className="pad">
          <div className={classnames({hide: step !== STEP_BASIC_INFO})}>
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
            <label htmlFor="signup-password">
              Password <span className="faint">(minimum 6 characters)</span>
            </label>
            <div className="form-control form-control--outlined">
              <input type="password"
                     required="required"
                     pattern=".{6,}"
                     id="signup-password"
                     name="signup-password"
                     placeholder="•••••••••••••"
                     ref={n => this._passwordInput = n}/>
            </div>
          </div>
          {step === STEP_CONFIRM_PASSWORD ? (
            <div className="text-center pad">
              <p className="notice info text-center txt-lg">
                Keep your password safe because it cannot be recovered
                <br/>
                <span className="txt-sm italic">
                  <Link href="https://insomnia.rest/documentation/plus/">Read More</Link>
                  {" "}
                  about how your password is used to encrypt your data
                </span>
              </p>
              <div className="text-left">
                <label htmlFor="signup-password-confirm" className="pad-left-sm">
                  Confirm your Password
                </label>
                <div className="form-control form-control--outlined">
                  <input type="password"
                         required="required"
                         pattern=".{6,}"
                         id="signup-password-confirm"
                         name="signup-password-confirm"
                         placeholder="•••••••••••••"
                         autoFocus="autoFocus"
                         onChange={this._checkPasswordsMatch.bind(this)}
                         ref={n => this._passwordConfirmInput = n}/>
                </div>
                <button type="button"
                        className="pad-sm faint"
                        onClick={e => this.setState({step: STEP_BASIC_INFO})}>
                  <i className="fa fa-caret-left"></i>
                  Go back
                </button>
              </div>
            </div>
          ) : null}
          {this.state.error ? (
            <div className="danger pad-top">** {this.state.error}</div>
          ) : null}
        </ModalBody>,
        <ModalFooter key="footer">
          <div className="margin-left">
            Already have an account?
            {" "}
            <a href="#" onClick={this._handleLogin.bind(this)}>Login</a>
          </div>
          <button type="submit" className="btn">
            {this.state.loading ?
              <i className="fa fa-spin fa-refresh margin-right-sm"></i> : null}
            Create Account
          </button>
        </ModalFooter>
      ]
    } else {
      inner = [
        <ModalHeader key="header">Account Created</ModalHeader>,
        <ModalBody key="body" className="pad">
          <h1>Thanks for signing up!</h1>
          <p>
            A verification email has been sent to your email address.
          </p>
        </ModalBody>,
        <ModalFooter key="footer">
          <button type="submit"
                  className="btn"
                  onClick={e => this._handleLogin(e)}>
            Proceed to Login
          </button>
        </ModalFooter>
      ]
    }

    return (
      <form onSubmit={this._handleSignup.bind(this)}>
        <Modal ref={m => this.modal = m} {...this.props}>
          {inner}
        </Modal>
      </form>
    )
  }
}

SignupModal.propTypes = {};
export default SignupModal;
