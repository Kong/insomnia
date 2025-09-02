import classnames from 'classnames';
import type { IpcRendererEvent } from 'electron';
import React, { type FC, useEffect, useState } from 'react';

import { getProductName } from '../../common/constants';
import imgSrcCore from '../images/insomnia-logo.svg';
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
        seenNotifications = (JSON.parse(storedKeys) as SeenNotifications) || {};
      }
    } catch (e) {}
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

  useEffect(() => {
    const unsubscribe = window.main.on('show-notification', (_: IpcRendererEvent, notification: ToastNotification) =>
      handleNotification(notification),
    );
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
      <div className="flex max-w-[20rem] flex-col items-center justify-center px-[var(--padding-xs)]">
        <p>{notification?.message || 'Unknown'}</p>
        <footer className="flex w-full flex-row justify-between pt-[var(--padding-sm)]">
          <button
            className="btn btn--super-super-compact btn--outlined"
            onClick={() => {
              if (notification) {
                // Hide the currently showing notification
                setVisible(false);
                // Give time for toast to fade out, then remove it
                setTimeout(() => {
                  setNotification(null);
                }, 1000);
              }
            }}
          >
            Dismiss
          </button>
          &nbsp;&nbsp;
          {notification.url && notification.cta && (
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
                  }, 1000);
                }
              }}
              href={notification.url}
            >
              {notification.cta}
            </Link>
          )}
        </footer>
      </div>
    </div>
  ) : null;
};
