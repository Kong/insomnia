import React, {PropTypes, Component} from 'react';
import Link from '../base/Link';
import PromptButton from '../base/PromptButton';

class SettingsSync extends Component {
  _handleClickLogout = async () => {
    this.props.handleExit();
    await this.props.handleLogout();
  };

  render () {
    const {
      loggedIn,
      firstName,
    } = this.props;

    return (
      <div>
        <h1 className="no-margin-top">Cloud Sync and Backup</h1>

        {loggedIn ? [
          <p key="1">
            Hi {firstName}! Thanks for signing up for Insomnia
            Plus.
          </p>,
          <p key="2" className="pad-top">
            <Link button={true} className="btn btn--clicky" href="https://insomnia.rest/app/">
              Manage Account
            </Link>
            {" "}
            <PromptButton className="btn btn--clicky" onClick={this._handleClickLogout}>
              Log Out
            </PromptButton>
          </p>
        ] : [
          <p key="0">
            <Link href="https://insomnia.rest/plus/">Insomnia Plus</Link> helps you <i>rest</i> easy
            by
            keeping your workspaces securely backed up and synced across all of your devices.
          </p>,
          <p key="1">
            Upgrade today to start enjoying
            {" "}
            <Link href="https://insomnia.rest/pricing/">all of the benefits</Link>, while also
            helping
            support my continuous effort of making Insomnia awesome! <i
            className="fa fa-smile-o txt-xl"/>
          </p>,
          <p key="2" className="pad-top text-center">
            <Link button={true}
                  href="https://insomnia.rest/pricing"
                  className="btn txt-lg btn--outlined">
              Create an Account
            </Link>
          </p>,
          <p key="3" className="text-center italic">
            <span className="txt-sm faint pad-top-sm">all plans include a free trial</span>
          </p>
        ]}
      </div>
    )
  }
}

SettingsSync.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  firstName: PropTypes.string.isRequired,
  handleExit: PropTypes.func.isRequired,
  handleCancelAccount: PropTypes.func.isRequired,
  handleLogout: PropTypes.func.isRequired,
  handleReset: PropTypes.func.isRequired,
};

export default SettingsSync;

