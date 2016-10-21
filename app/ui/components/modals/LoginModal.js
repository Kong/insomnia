import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../backend/sync/session';
import {getModal} from './index';
import SignupModal from './SignupModal';
import * as sync from '../../../backend/sync';

class LoginModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      step: 1,
      error: ''
    }
  }

  async _handleLogin (e) {
    e.preventDefault();
    this.setState({error: ''});

    const email = this._emailInput.value;
    const password = this._passwordInput.value;

    try {
      await session.login(email, password);
      this.setState({step: 2});
      sync.forceSync();
    } catch (e) {
      this.setState({error: e.message})
    }
  }

  _handleSignup (e) {
    e.preventDefault();

    this.modal.hide();
    getModal(SignupModal).show()
  }

  show () {
    this.setState({step: 1, error: ''});
    this.modal.show();
    setTimeout(() => this._emailInput.focus(), 100);
  }

  render () {
    if (this.state.step === 1) {
      return (
        <Modal ref={m => this.modal = m} {...this.props}>
          <form onSubmit={this._handleLogin.bind(this)}>
            <ModalHeader>Login to Your Account</ModalHeader>
            <ModalBody className="pad changelog">
              <label htmlFor="login-email">Email</label>
              <div className="form-control form-control--outlined">
                <input type="email"
                       required="required"
                       id="login-email"
                       name="login-email"
                       placeholder="me@mydomain.com"
                       ref={n => this._emailInput = n}/>
              </div>
              <label htmlFor="login-password">Password</label>
              <div className="form-control form-control--outlined">
                <input type="password"
                       required="required"
                       id="login-password"
                       name="login-password"
                       placeholder="•••••••••••••••••"
                       ref={n => this._passwordInput = n}/>
              </div>
              {this.state.error ? (
                <div className="danger pad-top">** {this.state.error}</div>
              ) : null}
            </ModalBody>
            <ModalFooter>
              <div className="margin-left">
                Don't have an account yet?
                {" "}
                <a href="#" onClick={this._handleSignup.bind(this)}>Signup</a>
              </div>
              <button type="submit" className="btn">
                Login
              </button>
            </ModalFooter>
          </form>
        </Modal>
      )
    } else {
      return (
        <Modal ref={m => this.modal = m} {...this.props}>
          <ModalHeader>Login Success</ModalHeader>
          <ModalBody className="pad">
            <h1>Enjoy your stay!</h1>
            <p>
              You are now logged in to the app.
            </p>
          </ModalBody>
          <ModalFooter>
            <button type="submit"
                    className="btn"
                    onClick={e => this.modal.hide()}>
              Close
            </button>
          </ModalFooter>
        </Modal>
      )
    }
  }
}

LoginModal.propTypes = {};

export default LoginModal;
