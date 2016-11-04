import React, {PropTypes} from 'react';
import Link from '../base/Link';
import PromptButton from '../base/PromptButton';

const SettingsSync = ({
  loggedIn,
  firstName,
  handleExit,
  handleUpdateSetting,
  handleShowSignup,
  handleCancelAccount,
  handleLogout,
}) => (
  <div>
    <p>
      Cloud Sync is part of
      {" "}
      <Link href="https://insomnia.rest/plus">Insomnia Plus</Link> – a
      $5/month add-on to Insomnia.
    </p>
    <p>
      Plus provides end-to-end encrypted data sync across all your
      devices, while also acting as an up-to-date backup in case something
      bad happens.
    </p>

    {loggedIn ? [
      <p key="1">
        All Insomnia Plus plans start with a 14 day trial period.
      </p>,
      <p key="2" className="pad-top-sm">
        <button className="btn btn--super-compact btn--outlined"
                onClick={() => {
                  handleExit();
                  handleShowSignup();
                  handleUpdateSetting('optSyncBeta', true);
                }}>
          Join Insomnia Plus
        </button>
      </p>
    ] : [
      <p key="1">
        Hi {firstName}! Thanks for signing up for Insomnia
        Plus.
      </p>,
      <p key="2">
        <PromptButton
          className="btn btn--super-compact btn--outlined danger"
          onClick={async () => {
            await handleCancelAccount();
            handleExit();
          }}>
          Cancel Subscription
        </PromptButton>
        {" "}
        <PromptButton
          className="btn btn--super-compact btn--outlined warning"
          onClick={async () => {
            await handleUpdateSetting('optSyncBeta', false);
            await handleLogout();
            handleExit()
          }}>
          Disable Sync
        </PromptButton>
        {" "}
        <PromptButton className="btn btn--super-compact btn--outlined"
                      onClick={async () => {
                        await handleLogout();
                        handleExit();
                      }}>
          Log Out
        </PromptButton>
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
};

export default SettingsSync;

