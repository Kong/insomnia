import React, {Component} from 'react';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../sync/session';
import {showModal} from './index';
import SignupModal from './SignupModal';
import * as sync from '../../../sync';
import {trackEvent} from '../../../analytics';

class LoginModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      step: 1,
      loading: false,
      error: '',
      title: '',
      message: '',
    }
  }

  async _handleLogin (e) {
    e.preventDefault();
    this.setState({error: '', loading: true});

    const email = this._emailInput.value;
    const password = this._passwordInput.value;

    try {
      await session.login(email, password);

      // Clear all existing sync data that might be there and enable sync
      process.nextTick(async () => {
        await sync.resetLocalData();
        await sync.doInitialSync();
      });

      this.setState({step: 2, loading: false});
    } catch (e) {
      this.setState({error: e.message, loading: false});
    }
  }

  _handleSignup (e) {
    e.preventDefault();

    this.modal.hide();
    showModal(SignupModal);
    trackEvent('Auth', 'Switch', 'To Signup');
  }

  show (options = {}) {
    const {title, message} = options;
    this.setState({step: 1, error: '', loading: false, title, message});
    this.modal.show();
    setTimeout(() => this._emailInput.focus(), 100);
  }

  render () {
    const {step, title, message} = this.state;
    let inner;
    if (step === 1) {
      inner = [
        <ModalHeader key="header">{title || "Login to Your Account"}</ModalHeader>,
        <ModalBody key="body" className="pad">
          {message ? (
            <p className="notice info">{message}</p>
          ) : null}
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
        </ModalBody>,
        <ModalFooter key="footer">
          <div className="margin-left">
            Don't have an account yet?
            {" "}
            <a href="#" onClick={this._handleSignup.bind(this)}>Signup</a>
          </div>
          <button type="submit" className="btn">
            {this.state.loading ? (
              <i className="fa fa-spin fa-refresh margin-right-sm"></i>
            ) : null}
            Login
          </button>
        </ModalFooter>
      ]
    } else {
      inner = [
        <ModalHeader key="header">Login Success</ModalHeader>,
        <ModalBody key="body" className="pad">
          <h1>Enjoy your stay!</h1>
          <p>
            If you have any questions or concerns, send you email to
            {" "}
            <Link href="mailto:support@insomnia.rest">
              support@insomnia.rest
            </Link>
          </p>
        </ModalBody>,
        <ModalFooter key="footer">
          <button type="submit"
                  className="btn"
                  onClick={e => this.modal.hide()}>
            Close
          </button>
        </ModalFooter>
      ]
    }

    return (
      <form onSubmit={this._handleLogin.bind(this)}>
        <Modal ref={m => this.modal = m} {...this.props}>
          {inner}
        </Modal>
      </form>
    )
  }
}

LoginModal.propTypes = {};

export default LoginModal;
