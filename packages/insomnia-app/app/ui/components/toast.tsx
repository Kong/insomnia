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
import Link from './base/link';
const LOCALSTORAGE_KEY = 'insomnia::notifications::seen';

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

@autoBindMethodsForReact(AUTOBIND_CFG)
class Toast extends PureComponent<{}, State> {
  _interval: NodeJS.Timeout | null = null;

  state: State = {
    notification: null,
    visible: false,
    appName: getAppName(),
  };

  _handlePostCTACleanup() {
    const { notification } = this.state;

    if (!notification) {
      return;
    }

    this._dismissNotification();
  }

  _handleCancelClick() {
    const { notification } = this.state;

    if (!notification) {
      return;
    }

    this._dismissNotification();
  }

  _hasSeenNotification(notification: ToastNotification) {
    const seenNotifications = this._loadSeen();

    return seenNotifications[notification.key];
  }

  async _checkForNotifications() {
    // If there is a notification open, skip check
    if (this.state.notification) {
      return;
    }

    const stats = await models.stats.get();
    const settings = await models.settings.getOrCreate();
    let notification: ToastNotification;

    // Try fetching user notification
    try {
      const data = {
        firstLaunch: stats.created,
        // Used for account verification notifications
        launches: stats.launches,
        // Used for CTAs / Informational notifications
        platform: getAppPlatform(),
        app: getAppId(),
        version: getAppVersion(),
        updatesNotSupported: !updatesSupported(),
        autoUpdatesDisabled: !settings.updateAutomatically,
        disableUpdateNotification: settings.disableUpdateNotification,
        updateChannel: settings.updateChannel,
      };
      notification = await fetch.post('/notification', data, session.getCurrentSessionId());
    } catch (err) {
      console.warn('[toast] Failed to fetch user notifications', err);
    }

    // @ts-expect-error -- TSCONVERSION
    this._handleNotification(notification);
  }

  _handleNotification(notification: ToastNotification | null | undefined) {
    // No new notifications
    if (!notification || this._hasSeenNotification(notification)) {
      return;
    }

    // Remember that we've seen it
    const seenNotifications = this._loadSeen();

    seenNotifications[notification.key] = true;
    const obj = JSON.stringify(seenNotifications, null, 2);
    window.localStorage.setItem(LOCALSTORAGE_KEY, obj);
    // Show the notification
    this.setState({
      notification,
      visible: false,
    });
    // Fade the notification in
    setTimeout(
      () =>
        this.setState({
          visible: true,
        }),
      1000,
    );
  }

  _loadSeen() {
    try {
      // @ts-expect-error -- TSCONVERSION
      return JSON.parse(window.localStorage.getItem(LOCALSTORAGE_KEY)) || {};
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
    this.setState({
      visible: false,
    });
    // Give time for toast to fade out, then remove it
    setTimeout(() => {
      this.setState(
        {
          notification: null,
        },
        async () => {
          await this._checkForNotifications();
        },
      );
    }, 1000);
  }

  _listenerShowNotification(_e, notification: ToastNotification) {
    console.log('[toast] Received notification ' + notification.key);

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
          <p>{notification ? notification.message : 'Unknown'}</p>
          <StyledFooter>
            <button
              className="btn btn--super-duper-compact btn--outlined"
              onClick={this._handleCancelClick}
            >
              Dismiss
            </button>
            &nbsp;&nbsp;
            <Link
              button
              className="btn btn--super-duper-compact btn--outlined no-wrap"
              onClick={this._handlePostCTACleanup}
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

export default Toast;
