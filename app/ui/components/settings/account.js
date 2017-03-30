import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import * as session from '../../../sync/session';
import * as sync from '../../../sync/index';
import Link from '../base/link';
import LoginModal from '../modals/login-modal';
import {hideAllModals, showModal} from '../modals/index';

@autobind
class Account extends PureComponent {
  async _handleLogout () {
    await sync.logout();
    this.forceUpdate();
  }

  _handleLogin (e) {
    e.preventDefault();
    hideAllModals();
    showModal(LoginModal);
  }

  renderUpgrade () {
    return (
      <div>
        <div className="notice pad surprise">
          <h1 className="no-margin-top">Get Insomnia Plus!</h1>
          <p>
            &#128640; Sync your data across devices or with a team<br/>
            &#128640; Keep synced data safe with end-to-end encryption<br/>
            &#128640; Access to premium color themes<br/>
            &#128640; Prioritized email support<br/>
          </p>
          <br/>
          <div className="pad">
            <Link button
                  className="btn btn--clicky"
                  href="https://insomnia.rest/plus/">
              Plus for Individuals <i className="fa fa-external-link"/>
            </Link>
            <Link button
                  className="margin-left-sm btn btn--clicky"
                  href="https://insomnia.rest/teams/">
              Plus for Teams <i className="fa fa-external-link"/>
            </Link>
          </div>
        </div>
        <p>
          Or <a href="" onClick={this._handleLogin}>Login</a>
        </p>
      </div>
    );
  }

  renderAccount () {
    return (
      <div>
        <h1 className="no-margin-top">
          Welcome {session.getFirstName()}!
        </h1>
        <p>
          You are currently logged in as
          {' '}
          <code className="code--compact">{session.getEmail()}</code>
        </p>
        <br/>
        <Link button
              href="https://insomnia.rest/app/"
              className="btn btn--clicky">
          Manage Account
        </Link>
        <button className="margin-left-sm btn btn--clicky"
                onClick={this._handleLogout}>
          Sign Out
        </button>
      </div>
    );
  }

  render () {
    return session.isLoggedIn() ? this.renderAccount() : this.renderUpgrade();
  }
}

export default Account;
