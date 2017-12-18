import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import * as session from '../../../sync/session';
import * as sync from '../../../sync/index';
import Link from '../base/link';
import LoginModal from '../modals/login-modal';
import {hideAllModals, showModal} from '../modals/index';
import PromptButton from '../base/prompt-button';

@autobind
class Account extends PureComponent {
  renderUpgrade () {
    return (
      <div>
        <div className="notice pad surprise">
          <h1 className="no-margin-top">Fuck Insomnia Plus!</h1>
          <p>
            &#128640; Bullshit<br/>
            &#128640; Bullshit<br/>
            &#128640; Bullshit<br/>
            &#128640; Bullshit<br/>
          </p>
          <br/>
          <div className="pad">
            <Link button
                  className="btn btn--clicky"
                  href="https://xkcd.com/no">
              Bullshit for Individuals <i className="fa fa-external-link"/>
            </Link>
            <Link button
                  className="margin-left-sm btn btn--clicky"
                  href="https://xkcd.com/no/">
              Bullshit for Teams <i className="fa fa-external-link"/>
            </Link>
          </div>
        </div>
        <p>
          Or <a href="#" disabled>Fuck No</a>
        </p>
      </div>
    );
  }

  render () {
    return this.renderUpgrade();
  }
}

export default Account;
