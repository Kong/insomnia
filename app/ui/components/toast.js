import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import GravatarImg from './gravatar-img';
import Link from './base/link';
import * as fetch from '../../common/fetch';
import {trackEvent} from '../../analytics/index';
import * as models from '../../models/index';
import * as constants from '../../common/constants';
import * as db from '../../common/database';

const LOCALSTORAGE_KEY = 'insomnia::notifications::seen';

@autobind
class Toast extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {notification: null, visible: false};
  }

  _handlePostCTACleanup () {
    trackEvent('Notification', 'Click', this.state.notification.key);
    this._dismissNotification();
  }

  _handleCancelClick () {
    trackEvent('Notification', 'Dismiss', this.state.notification.key);
    this._dismissNotification();
  }

  async _handleCheckNotifications () {
    // If there is a notification open, skip check
    if (this.state.notification) {
      return;
    }

    const seenNotifications = this._loadSeen();
    const stats = await models.stats.get();

    let notification;
    try {
      const data = {
        lastLaunch: stats.lastLaunch,
        firstLaunch: stats.created,
        launches: stats.launches,
        platform: constants.getAppPlatform(),
        version: constants.getAppVersion(),
        requests: await db.count(models.request.type),
        requestGroups: await db.count(models.requestGroup.type),
        environments: await db.count(models.environment.type),
        workspaces: await db.count(models.workspace.type)
      };

      notification = await fetch.post(`/notification`, data);
    } catch (e) {
      console.warn('[toast] Failed to fetch notifications', e);
    }

    // No new notifications
    if (!notification) {
      return;
    }

    // We've already seen this one, so bail
    if (seenNotifications && seenNotifications[notification.key]) {
      return;
    }

    // Remember that we've seen it
    seenNotifications[notification.key] = true;
    const obj = JSON.stringify(seenNotifications, null, 2);
    window.localStorage.setItem(LOCALSTORAGE_KEY, obj);

    // Show the notification
    this.setState({notification, visible: false});

    // Fade the notification in
    setTimeout(() => this.setState({visible: true}), 1000);
  }

  _loadSeen () {
    try {
      return JSON.parse(window.localStorage.getItem(LOCALSTORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  _dismissNotification () {
    const {notification} = this.state;
    if (!notification) {
      return;
    }

    // Hide the currently showing notification
    this.setState({visible: false});

    // Give time for toast to fade out, then remove it
    setTimeout(() => {
      this.setState({notification: null});
    }, 1000);
  }

  componentDidMount () {
    setTimeout(this._handleCheckNotifications, 1000 * 10);
    this._interval = setInterval(this._handleCheckNotifications, 1000 * 60 * 10);
  }

  componentWillUnmount () {
    clearInterval(this._interval);
  }

  render () {
    const {notification, visible} = this.state;

    if (!notification) {
      return null;
    }

    return (
      <div className={classnames('toast', {'toast--show': visible})}>
        <div className="toast__image">
          <GravatarImg email={notification.email || 'gschier1990@gmail.com'} size={100}/>
        </div>
        <div className="toast__content">
          <p className="toast__message">
            {notification ? notification.message : 'Unknown'}
          </p>
          <footer className="toast__actions">
            <button className="btn btn--super-duper-compact btn--outlined"
                    onClick={this._handleCancelClick}>
              Dismiss
            </button>
            &nbsp;&nbsp;
            <Link button
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

Toast.propTypes = {};

export default Toast;
