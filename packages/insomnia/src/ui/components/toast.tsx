import classnames from 'classnames';
import type { IpcRendererEvent } from 'electron';
import React, { type FC, useEffect, useState } from 'react';

import {
  getAppId,
  getAppPlatform,
  getAppVersion,
  getProductName,
  updatesSupported,
} from '../../common/constants';
import * as models from '../../models/index';
import { insomniaFetch } from '../../ui/insomniaFetch';
import imgSrcCore from '../images/insomnia-logo.svg';
import { useRootLoaderData } from '../routes/root';
import { Link } from './base/link';

const INSOMNIA_NOTIFICATIONS_SEEN = 'insomnia::notifications::seen';

export interface ToastNotification {
  key: string;
  url?: string;
  cta?: string;
  message: string;
}

type SeenNotifications = Record<string, boolean>;

export const Toast: FC = () => {
  const { userSession } = useRootLoaderData();
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
      const notificationOrEmpty = await insomniaFetch<ToastNotification>({
        method: 'POST',
        path: '/notification',
        data,
        sessionId: userSession.id,
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
      <div className="m-[var(--padding-xs)] mr-[var(--padding-sm)] flex items-center justify-center">
        <img className="max-w-[5rem]" src={imgSrcCore} alt={productName} />
      </div>
      <div className="flex items-center justify-center flex-col px-[var(--padding-xs)] max-w-[20rem]">

        <p>{notification?.message || 'Unknown'}</p>
        <footer className="pt-[var(--padding-sm)] flex flex-row justify-between w-full">

          <button
            className="btn btn--super-super-compact btn--outlined"
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
          {notification.url && notification.cta &&
            <Link
              button
              className="btn btn--super-super-compact btn--outlined no-wrap"
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
          }
        </footer>
      </div>
    </div>
  ) : null;
};
