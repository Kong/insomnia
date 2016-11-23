import React, {PropTypes, Component} from 'react';
import classnames from 'classnames';
import {TAB_PLUS} from './modals/SettingsModal';
import SettingsModal from './modals/SettingsModal';
import {showModal} from './modals';
import * as analytics from '../../analytics/index';

const LOCALSTORAGE_KEY = 'insomnia::notifications::seen';
const KEY_PLUS_IS_HERE = 'plus-is-here';

class Toast extends Component {
  constructor (props) {
    super(props);

    this.state = {
      notification: null,
      visible: false,
    };

    this._notifications = [
      // TODO: Fetch these from remote server
      // {
      //   key: KEY_PLUS_IS_HERE,
      //   message: 'Cloud sync is here!',
      //   cta: 'Show'
      // }
    ];
  }

  _loadSeen () {
    try {
      return JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  _markAsRead (notification) {
    const seen = this._loadSeen();
    seen[notification.key] = true;
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(seen, null, 2));
    this._handleHideActiveNotification();
  }

  _handleClick (notification) {
    if (!notification) {
      // Not sure how this happened, but Sentry says it has
      return;
    }

    if (notification.key === KEY_PLUS_IS_HERE) {
      showModal(SettingsModal, TAB_PLUS);
    }

    this._markAsRead(notification);

    analytics.trackEvent('Notification', 'Click', notification.key);
  }

  _handleShowNotifications () {
    const seen = this._loadSeen();
    for (const notification of this._notifications) {
      if (seen && seen[notification.key]) {
        continue;
      }

      this.setState({notification, visible: true});
    }
  }

  _handleHideActiveNotification () {
    const {notification} = this.state;
    if (notification) {
      this.setState({visible: false});
    }

    // Give time for toast to fade out, then remove it
    setTimeout(() => {
      this.setState({notification: null});
    }, 1000);
  }

  componentDidMount () {
    setTimeout(() => this._handleShowNotifications(), 1000 * 10);
    setTimeout(() => this._handleHideActiveNotification(), 1000 * 100);
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
        <button className="toast__action" onClick={e => this._handleClick(notification)}>
          {notification ? notification.cta : 'Hide'}
        </button>
      </div>
    )
  }
}

Toast.propTypes = {};

export default Toast;
