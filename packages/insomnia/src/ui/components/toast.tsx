import classnames from 'classnames';
import type { IpcRendererEvent } from 'electron';
import React, { FC, useEffect, useState } from 'react';
import styled from 'styled-components';

import * as session from '../../account/session';
import {
  getAppId,
  getAppPlatform,
  getAppVersion,
  getProductName,
  updatesSupported,
} from '../../common/constants';
import * as models from '../../models/index';
import imgSrcCore from '../images/insomnia-logo.svg';
import { Link } from './base/link';

const INSOMNIA_NOTIFICATIONS_SEEN = 'insomnia::notifications::seen';

export interface ToastNotification {
  key: string;
  url: string;
  cta: string;
  message: string;
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

export const Toast: FC = () => {
  const [notification, setNotification] = useState<ToastNotification | null>(null);
  const [visible, setVisible] = useState(false);
  const handleNotification = (notification: ToastNotification | null | undefined) => {
    if (!notification) {
      return;
    }
    let seenNotifications: SeenNotifications = {};
    try {
      const storedKeys = window.localStorage.getItem(INSOMNIA_NOTIFICATIONS_SEEN);
      if (storedKeys) {
        seenNotifications = JSON.parse(storedKeys) as SeenNotifications || {};
      }
    } catch (e) { }
    console.log(`[toast] Received notification ${notification.key}`);
    if (seenNotifications[notification.key]) {
      console.log(`[toast] Not showing notification ${notification.key} because has already been seen`);
      return;
    }
    seenNotifications[notification.key] = true;
    window.localStorage.setItem(INSOMNIA_NOTIFICATIONS_SEEN, JSON.stringify(seenNotifications, null, 2));
    setNotification(notification);
    setVisible(false);
    // Fade the notification in
    setTimeout(() => {
      setVisible(true);
    }, 1000);
  };
  const checkForNotifications = async () => {
    // If there is a notification open, skip check
    if (notification) {
      return;
    }
    const stats = await models.stats.get();
    const {
      disableUpdateNotification,
      updateAutomatically,
      updateChannel,
    } = await models.settings.get();
    let updatedNotification: ToastNotification | null = null;
    // Try fetching user notification
    try {
      const data = {
        app: getAppId(),
        autoUpdatesDisabled: !updateAutomatically,
        disableUpdateNotification,
        firstLaunch: stats.created,
        launches: stats.launches, // Used for account verification notifications
        platform: getAppPlatform(), // Used for CTAs / Informational notifications
        updateChannel,
        updatesNotSupported: !updatesSupported(),
        version: getAppVersion(),
      };
      const notificationOrEmpty = await window.main.insomniaFetch<ToastNotification>({
        method: 'POST',
        path: '/notification',
        data,
        sessionId: session.getCurrentSessionId(),
      });
      if (notificationOrEmpty && typeof notificationOrEmpty !== 'string') {
        updatedNotification = notificationOrEmpty;
      }
    } catch (err) {
      console.warn('[toast] Failed to fetch user notifications', err);
    }
    handleNotification(updatedNotification);
  };

  useEffect(() => {
    const unsubscribe = window.main.on('show-notification', (_: IpcRendererEvent, notification: ToastNotification) => handleNotification(notification));
    return () => unsubscribe();
  }, []);

  const productName = getProductName();
  return notification ? (
    <div
      className={classnames('toast theme--dialog', {
        'toast--show': visible,
      })}
    >
      <StyledLogo>
        <img src={imgSrcCore} alt={productName} />
      </StyledLogo>
      <StyledContent>
        <p>{notification?.message || 'Unknown'}</p>
        <StyledFooter>
          <button
            className="btn btn--super-duper-compact btn--outlined"
            onClick={() => {
              if (notification) {
                // Hide the currently showing notification
                setVisible(false);
                // Give time for toast to fade out, then remove it
                setTimeout(() => {
                  setNotification(null);
                  checkForNotifications();
                }, 1000);
              }
            }}
          >
            Dismiss
          </button>
          &nbsp;&nbsp;
          <Link
            button
            className="btn btn--super-duper-compact btn--outlined no-wrap"
            onClick={() => {
              if (notification) {
                // Hide the currently showing notification
                setVisible(false);
                // Give time for toast to fade out, then remove it
                setTimeout(() => {
                  setNotification(null);
                  checkForNotifications();
                }, 1000);
              }
            }}
            href={notification.url}
          >
            {notification.cta}
          </Link>
        </StyledFooter>
      </StyledContent>
    </div>
  ) : null;
};
