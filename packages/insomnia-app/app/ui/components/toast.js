// @flow
import * as React from 'react';
import * as electron from 'electron';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import styled from 'styled-components';
import classnames from 'classnames';
import Link from './base/link';
import * as models from '../../models/index';
import {
  AUTOBIND_CFG,
  getAppName,
  getAppPlatform,
  getAppId,
  getAppVersion,
  updatesSupported,
} from '../../common/constants';
import * as db from '../../common/database';
import * as session from '../../account/session';
import * as fetch from '../../account/fetch';
import imgSrcCore from '../images/insomnia-core-logo.png';
import { getDeviceId } from '../../common/analytics';

const LOCALSTORAGE_KEY = 'insomnia::notifications::seen';

export type ToastNotification = {
  key: string,
  url: string,
  cta: string,
  message: string,
};

type Props = {};

type State = {
  notification: ToastNotification | null,
  visible: boolean,
};

const StyledLogo: React.ComponentType<{}> = styled.div`
  margin: var(--padding-xs) var(--padding-sm) var(--padding-xs) var(--padding-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  img {
    max-width: 5rem;
  }
`;

const StyledContent: React.ComponentType<{}> = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 var(--padding-xs) 0 var(--padding-xs);
  max-width: 20rem;
`;

const StyledFooter: React.ComponentType<{}> = styled.footer`
  padding-top: var(--padding-sm);
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
`;

@autoBindMethodsForReact(AUTOBIND_CFG)
class Toast extends React.PureComponent<Props, State> {
  _interval: any;

  constructor(props: Props) {
    super(props);
    this.state = {
      notification: null,
      visible: false,
      appName: getAppName(),
    };
  }

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
        launches: stats.launches,
        platform: getAppPlatform(),
        app: getAppId(),
        version: getAppVersion(),
        requests: await db.count(models.request.type),
        requestGroups: await db.count(models.requestGroup.type),
        environments: await db.count(models.environment.type),
        workspaces: await db.count(models.workspace.type),
        updatesNotSupported: !updatesSupported(),
        autoUpdatesDisabled: !settings.updateAutomatically,
        disableUpdateNotification: settings.disableUpdateNotification,
        updateChannel: settings.updateChannel,
        deviceId: await getDeviceId(),
        createdRequests: stats.createdRequests,
        deletedRequests: stats.deletedRequests,
        executedRequests: stats.executedRequests,
      };

      notification = await fetch.post('/notification', data, session.getCurrentSessionId());
    } catch (err) {
      console.warn('[toast] Failed to fetch user notifications', err);
    }

    this._handleNotification(notification);
  }

  _handleNotification(notification: ?ToastNotification) {
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
    this.setState({ notification, visible: false });

    // Fade the notification in
    setTimeout(() => this.setState({ visible: true }), 1000);
  }

  _loadSeen() {
    try {
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
    this.setState({ visible: false });

    // Give time for toast to fade out, then remove it
    setTimeout(() => {
      this.setState({ notification: null }, async () => {
        await this._checkForNotifications();
      });
    }, 1000);
  }

  _listenerShowNotification(e: any, notification: ToastNotification) {
    console.log('[toast] Received notification ' + notification.key);
    this._handleNotification(notification);
  }

  componentDidMount() {
    setTimeout(this._checkForNotifications, 1000 * 10);
    this._interval = setInterval(this._checkForNotifications, 1000 * 60 * 30);
    electron.ipcRenderer.on('show-notification', this._listenerShowNotification);
  }

  componentWillUnmount() {
    clearInterval(this._interval);
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
        })}>
        <StyledLogo>
          <img src={imgSrcCore} alt={appName} />
        </StyledLogo>
        <StyledContent>
          <p>{notification ? notification.message : 'Unknown'}</p>
          <StyledFooter>
            <button
              className="btn btn--super-duper-compact btn--outlined"
              onClick={this._handleCancelClick}>
              Dismiss
            </button>
            &nbsp;&nbsp;
            <Link
              button
              className="btn btn--super-duper-compact btn--outlined no-wrap"
              onClick={this._handlePostCTACleanup}
              href={notification.url}>
              {notification.cta}
            </Link>
          </StyledFooter>
        </StyledContent>
      </div>
    );
  }
}

export default Toast;
