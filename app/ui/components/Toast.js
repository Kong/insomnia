import React, {PropTypes, Component} from 'react';
import classnames from 'classnames';
import Link from './base/Link';
import * as fetch from '../../common/fetch';
import {trackEvent} from '../../analytics/index';

const LOCALSTORAGE_KEY = 'insomnia::notifications::seen';

class Toast extends Component {
  constructor (props) {
    super(props);

    this.state = {
      notification: null,
      visible: false,
    };
  }

  _loadSeen () {
    try {
      return JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  _handleDismissActiveNotification () {
    const {notification} = this.state;
    if (!notification) {
      return;
    }

    // Remember that we've seen it
    const seen = this._loadSeen();
    seen[notification.key] = true;
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(seen, null, 2));

    // Hide the currently showing notification
    this.setState({visible: false});

    // Give time for toast to fade out, then remove it
    setTimeout(() => {
      this.setState({notification: null});
    }, 1000);

    trackEvent('Notification', 'Dismiss', notification.key);
  }

  async _handleCheckNotifications () {
    // If there is a notification open, skip check
    if (this.state.notification) {
      return;
    }

    const seenNotifications = this._loadSeen();

    let notification;
    try {
      notification = await fetch.get('/notification');
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

    // Show the notification
    this.setState({notification, visible: false});

    // Fade the notification in
    setTimeout(() => this.setState({visible: true}), 1000);
  }

  componentDidMount () {
    setInterval(() => this._handleCheckNotifications(), 1000);
  }

  render () {
    const {notification, visible} = this.state;

    if (!notification) {
      return null;
    }

    const actions = notification && notification.actions || [];

    return (
      <div className={classnames('toast', {'toast--show': visible})}>
        <div className="toast__message">
          {notification ? notification.message : 'Unknown'}
        </div>
        {actions.map(action => (
          <div className="toast__action" key={action.key}>
            <Link className="btn btn--super-duper-compact btn--outlined"
                  onClick={e => trackEvent('Notification', 'Click', `${notification.key}/${action.key}`)}
                  button={true}
                  href={action.url}>
              {action ? action.name : 'Thing'}
            </Link>
          </div>
        ))}
        <div className="toast__action toast__action--close">
          <button className="btn btn--super-duper-compact"
                  onClick={e => this._handleDismissActiveNotification()}>
            <i className="fa fa-close"></i>
          </button>
        </div>
      </div>
    )
  }
}

Toast.propTypes = {};

export default Toast;
