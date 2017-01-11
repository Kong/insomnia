import React, {PropTypes, Component} from 'react';
import classnames from 'classnames';
import Link from './base/Link';
import * as fetch from '../../common/fetch';
import {trackEvent} from '../../analytics/index';
import * as models from '../../models/index';
import * as querystring from '../../common/querystring';
import * as constants from '../../common/constants';
import * as db from '../../common/database';

const LOCALSTORAGE_KEY = 'insomnia::notifications::seen';

class Toast extends Component {
  state = {notification: null, visible: false};

  _handlePostCTACleanup = () => {
    trackEvent('Notification', 'Click', this.state.notification.key);
    this._dismissNotification();
  };

  _handleCancelClick = () => {
    trackEvent('Notification', 'Dismiss', this.state.notification.key);
    this._dismissNotification();
  };

  _handleCheckNotifications = async () => {
    // If there is a notification open, skip check
    if (this.state.notification) {
      return;
    }

    const seenNotifications = this._loadSeen();
    const stats = await models.stats.get();

    let notification;
    try {
      const queryParameters = [
        {name: 'lastLaunch', value: stats.lastLaunch},
        {name: 'firstLaunch', value: stats.created},
        {name: 'launches', value: stats.launches},
        {name: 'platform', value: constants.getAppPlatform()},
        {name: 'version', value: constants.getAppVersion()},
        {name: 'requests', value: (await db.count(models.request.type)) + ''},
        {name: 'requestGroups', value: (await db.count(models.requestGroup.type)) + ''},
        {name: 'environments', value: (await db.count(models.environment.type)) + ''},
        {name: 'workspaces', value: (await db.count(models.workspace.type)) + ''},
      ];

      console.log(queryParameters);

      const qs = querystring.buildFromParams(queryParameters);
      notification = await fetch.get(`/notification?${qs}`);
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
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(seenNotifications, null, 2));

    // Show the notification
    this.setState({notification, visible: false});

    // Fade the notification in
    setTimeout(() => this.setState({visible: true}), 1000);

    trackEvent('Notification', 'Shown', notification.key, {nonInteraction: true});
  };

  _loadSeen () {
    try {
      return JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY)) || {};
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
        <div className="toast__message">
          {notification ? notification.message : 'Unknown'}
        </div>
        <div className="toast__action">
          <Link className="btn btn--super-duper-compact btn--outlined no-wrap"
                onClick={this._handlePostCTACleanup}
                button={true}
                href={notification.url}>
            {notification.cta}
          </Link>
        </div>
        <div className="toast__action toast__action--close">
          <button className="btn btn--super-duper-compact" onClick={this._handleCancelClick}>
            <i className="fa fa-close"></i>
          </button>
        </div>
      </div>
    )
  }
}

Toast.propTypes = {};

export default Toast;
