// @flow
import * as React from 'react';
import * as electron from 'electron';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import GravatarImg from './gravatar-img';
import Link from './base/link';
import * as fetch from '../../common/fetch';
import * as models from '../../models/index';
import * as constants from '../../common/constants';
import * as db from '../../common/database';

const LOCALSTORAGE_KEY = 'insomnia::notifications::seen';

export type ToastNotification = {
  key: string,
  url: string,
  cta: string,
  message: string,
  email: string
};

type Props = {};

type State = {
  notification: ToastNotification | null,
  visible: boolean
};

@autobind
class Toast extends React.PureComponent<Props, State> {
  _interval: any;

  constructor(props: Props) {
    super(props);
    this.state = {
      notification: null,
      visible: false
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
        platform: constants.getAppPlatform(),
        version: constants.getAppVersion(),
        requests: await db.count(models.request.type),
        requestGroups: await db.count(models.requestGroup.type),
        environments: await db.count(models.environment.type),
        workspaces: await db.count(models.workspace.type),
        updatesNotSupported: constants.isLinux(),
        autoUpdatesDisabled: !settings.updateAutomatically,
        updateChannel: !settings.updateChannel
      };

      notification = await fetch.post(`/notification`, data);
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
    electron.ipcRenderer.on(
      'show-notification',
      this._listenerShowNotification
    );
  }

  componentWillUnmount() {
    clearInterval(this._interval);
    electron.ipcRenderer.removeListener(
      'show-notification',
      this._listenerShowNotification
    );
  }

  render() {
    const { notification, visible } = this.state;

    if (!notification) {
      return null;
    }

    return (
      <div
        className={classnames('toast theme--dialog', {
          'toast--show': visible
        })}>
        <div className="toast__image">
          <GravatarImg
            email={notification.email || 'gschier1990@gmail.com'}
            size={100}
          />
        </div>
        <div className="toast__content">
          <p className="toast__message">
            {notification ? notification.message : 'Unknown'}
          </p>
          <footer className="toast__actions">
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
          </footer>
        </div>
      </div>
    );
  }
}

export default Toast;
