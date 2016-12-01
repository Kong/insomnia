import React, {PropTypes} from 'react';
import Link from '../base/Link';
import PromptButton from '../base/PromptButton';
import {trackEvent} from '../../../analytics/index';
import {showModal} from '../modals/index';
import PaymentModal from '../modals/PaymentModal';

const SettingsSync = ({
  loggedIn,
  firstName,
  handleExit,
  handleUpdateSetting,
  handleShowSignup,
  handleCancelAccount,
  handleLogout,
  handleReset,
}) => (
  <div>
    <h1 className="no-margin-top">Cloud Sync and Backup</h1>

    {loggedIn ? [
      <p key="1">
        Hi {firstName}! Thanks for signing up for Insomnia
        Plus.
      </p>,
      <p key="2" className="pad-top">
        <PromptButton
          className="btn btn--clicky danger"
          onClick={() => {
            handleExit();
            handleCancelAccount();
          }}>
          Cancel Subscription
        </PromptButton>
        {" "}
        <PromptButton className="btn btn--clicky warning"
                      onClick={handleReset}
                      confirmMessage="Delete all sync-related data?">
          Reset Remote Data
        </PromptButton>
        {" "}
        <button className="btn btn--clicky"
                onClick={async () => {
                  handleExit();
                  showModal(PaymentModal);
                }}>
          Update Billing
        </button>
        {" "}
        <PromptButton className="btn btn--clicky"
                      onClick={async () => {
                        handleExit();
                        await handleLogout();
                      }}>
          Log Out
        </PromptButton>
      </p>
    ] : [
      <p key="0">
        <Link href="https://insomnia.rest/plus/">Insomnia Plus</Link> helps you <i>rest</i> easy by
        keeping your workspaces securely backed up and synced across all of your devices.
      </p>,
      <p key="1">
        Upgrade today to start enjoying
        {" "}
        <Link href="https://insomnia.rest/pricing/">all of the benefits</Link>, while also helping
        support my continuous effort of making Insomnia awesome! <i
        className="fa fa-smile-o txt-xl"/>
      </p>,
      <p key="2" className="pad-top text-center">
        <button className="btn txt-lg btn--outlined"
                onClick={() => {
                  handleExit();
                  trackEvent('Settings Sync', 'Click Upgrade');
                  handleShowSignup()
                }}>
          Upgrade to Plus
        </button>
      </p>,
      <p key="3" className="text-center italic">
        $5 per month or $50 per year
        <br/>
        <span className="txt-sm faint pad-top-sm">
          14-day trial (cancel at any time)
        </span>
      </p>
    ]}
  </div>
);

SettingsSync.propTypes = {
  loggedIn: PropTypes.bool.isRequired,
  firstName: PropTypes.string.isRequired,
  handleExit: PropTypes.func.isRequired,
  handleUpdateSetting: PropTypes.func.isRequired,
  handleShowSignup: PropTypes.func.isRequired,
  handleCancelAccount: PropTypes.func.isRequired,
  handleLogout: PropTypes.func.isRequired,
  handleReset: PropTypes.func.isRequired,
};

export default SettingsSync;

