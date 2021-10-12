import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import * as electron from 'electron';
import React, { PureComponent } from 'react';
import styled from 'styled-components';

import * as fetch from '../../account/fetch';
import * as session from '../../account/session';
import {
  AUTOBIND_CFG,
  getAppId,
  getAppName,
  getAppPlatform,
  getAppVersion,
  updatesSupported,
} from '../../common/constants';
import * as models from '../../models/index';
import imgSrcCore from '../images/insomnia-core-logo.png';
import { Link } from './base/link';

const INSOMNIA_NOTIFICATIONS_SEEN = 'insomnia::notifications::seen';

export interface ToastNotification {
  key: string;
  url: string;
  cta: string;
  message: string;
}

interface State {
  notification: ToastNotification | null;
  visible: boolean;
  appName: string;
}

const StyledLogo = styled.div`
  margin: var(--padding-xs) var(--padding-sm) var(--padding-xs) var(--padding-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  img {
    max-width: 5rem;
  }
`;
const StyledContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 var(--padding-xs) 0 var(--padding-xs);
  max-width: 20rem;
`;
const StyledFooter = styled.footer`
  padding-top: var(--padding-sm);
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
`;

type SeenNotifications = Record<string, boolean>;

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Toast extends PureComponent<{}, State> {
  _interval: NodeJS.Timeout | null = null;

  state: State = {
    notification: null,
    visible: false,
    appName: getAppName(),
  };

  _cancel() {
    const { notification } = this.state;

    if (!notification) {
      return;
    }

    this._dismissNotification();
  }

  _handleNotification(notification: ToastNotification | null | undefined) {
    if (!notification) {
      return;
    }

    const seenNotifications = this._loadSeen();

    console.log(`[toast] Received notification ${notification.key}`);

    if (seenNotifications[notification.key]) {
      console.log(`[toast] Not showing notification ${notification.key} because has already been seen`);
      return;
    }

    seenNotifications[notification.key] = true;
    const obj = JSON.stringify(seenNotifications, null, 2);
    window.localStorage.setItem(INSOMNIA_NOTIFICATIONS_SEEN, obj);

    this.setState({
      notification,
      visible: false,
    });

    // Fade the notification in
    setTimeout(() => { this.setState({ visible: true }); }, 1000);
  }

  async _checkForNotifications() {
    // If there is a notification open, skip check
    if (this.state.notification) {
      return;
    }

    const stats = await models.stats.get();
    const {
      allowNotificationRequests,
      disablePaidFeatureAds,
      disableUpdateNotification,
      updateAutomatically,
      updateChannel,
    } = await models.settings.getOrCreate();

    if (!allowNotificationRequests) {
      // if the user has specifically said they don't want to send notification requests, then exit early
      return;
    }

    let notification: ToastNotification | null = null;

    // Try fetching user notification
    try {
      const data = {
        app: getAppId(),
        autoUpdatesDisabled: !updateAutomatically,
        disablePaidFeatureAds,
        disableUpdateNotification,
        firstLaunch: stats.created,
        launches: stats.launches, // Used for account verification notifications
        platform: getAppPlatform(), // Used for CTAs / Informational notifications
        updateChannel,
        updatesNotSupported: !updatesSupported(),
        version: getAppVersion(),
      };
      notification = await fetch.post('/notification', data, session.getCurrentSessionId());
    } catch (err) {
      console.warn('[toast] Failed to fetch user notifications', err);
    }

    this._handleNotification(notification);
  }

  _loadSeen() {
    try {
      const storedKeys = window.localStorage.getItem(INSOMNIA_NOTIFICATIONS_SEEN);
      if (!storedKeys) {
        return {};
      }

      return JSON.parse(storedKeys) as SeenNotifications || {};
    } catch (e) {
      return {};
    }
  }

  _dismissNotification() {
    const { notification } = this.state;

    if (!notification) {
      return;
    }

    // Hide the currently showing notification
    this.setState({ visible: false });

    // Give time for toast to fade out, then remove it
    setTimeout(() => {
      this.setState({ notification: null }, this._checkForNotifications);
    }, 1000);
  }

  _listenerShowNotification(_e, notification: ToastNotification) {
    this._handleNotification(notification);
  }

  componentDidMount() {
    setTimeout(this._checkForNotifications, 1000 * 10);
    this._interval = setInterval(this._checkForNotifications, 1000 * 60 * 30);
    electron.ipcRenderer.on('show-notification', this._listenerShowNotification);
  }

  componentWillUnmount() {
    if (this._interval !== null) {
      clearInterval(this._interval);
    }
    electron.ipcRenderer.removeListener('show-notification', this._listenerShowNotification);
  }

  render() {
    const { notification, visible, appName } = this.state;

    if (!notification) {
      return null;
    }

    return (
      <div
        className={classnames('toast theme--dialog', {
          'toast--show': visible,
        })}
      >
        <StyledLogo>
          <img src={imgSrcCore} alt={appName} />
        </StyledLogo>
        <StyledContent>
          <p>{notification?.message || 'Unknown'}</p>
          <StyledFooter>
            <button
              className="btn btn--super-duper-compact btn--outlined"
              onClick={this._cancel}
            >
              Dismiss
            </button>
            &nbsp;&nbsp;
            <Link
              button
              className="btn btn--super-duper-compact btn--outlined no-wrap"
              onClick={this._cancel}
              href={notification.url}
            >
              {notification.cta}
            </Link>
          </StyledFooter>
        </StyledContent>
      </div>
    );
  }
}
