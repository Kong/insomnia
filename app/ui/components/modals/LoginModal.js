import React, {PureComponent} from 'react';
import Link from '../base/Link';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as session from '../../../sync/session';
import * as sync from '../../../sync';

class LoginModal extends PureComponent {
  state = {
    step: 1,
    loading: false,
    error: '',
    title: '',
    message: '',
  };

  _setModalRef = n => this.modal = n;
  _setEmailInputRef = n => this._emailInput = n;
  _hide = () => this.hide();

  _handleLogin = async e => {
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
  };

  show (options = {}) {
    const {title, message} = options;
    this.setState({step: 1, error: '', loading: false, title, message});
    this.modal.show();
    setTimeout(() => this._emailInput.focus(), 100);
  }

  hide () {
    this.modal.hide();
  }

  render () {
    const {step, title, message, loading, error} = this.state;
    let inner;
    if (step === 1) {
      inner = [
        <ModalHeader key="header">{title || "Login to Your Account"}</ModalHeader>,
        <ModalBody key="body" className="pad">
          {message ? (
            <p className="notice info">{message}</p>
          ) : null}
          <div className="form-control form-control--outlined no-pad-top">
            <label>Email
              <input
                type="email"
                required="required"
                placeholder="me@mydomain.com"
                ref={this._setEmailInputRef}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>Password
              <input type="password"
                     required="required"
                     placeholder="•••••••••••••••••"
                     ref={n => this._passwordInput = n}/>
            </label>
          </div>
          {error ? <div className="danger pad-top">** {error}</div> : null}
        </ModalBody>,
        <ModalFooter key="footer">
          <div className="margin-left">
            Don't have an account yet?
            {" "}
            <Link href="https://insomnia.rest/app/">Signup</Link>
          </div>
          <button type="submit" className="btn">
            {loading ? <i className="fa fa-spin fa-refresh margin-right-sm"></i> : null}
            Login
          </button>
        </ModalFooter>
      ]
    } else {
      inner = [
        <ModalHeader key="header">Login Success</ModalHeader>,
        <ModalBody key="body" className="pad no-pad-top">
          <h1>Enjoy your stay!</h1>
          <p>
            If you have any questions or concerns, send you email to
            {" "}
            <Link href="https://insomnia.rest/documentation/support-and-feedback/">
              support@insomnia.rest
            </Link>
          </p>
        </ModalBody>,
        <ModalFooter key="footer">
          <button type="button" className="btn" onClick={this._hide}>
            Close
          </button>
        </ModalFooter>
      ]
    }

    return (
      <form onSubmit={this._handleLogin}>
        <Modal ref={this._setModalRef} {...this.props}>
          {inner}
        </Modal>
      </form>
    )
  }
}

LoginModal.propTypes = {};

export default LoginModal;
