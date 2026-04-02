import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { format } from 'date-fns';
import React from 'react';
import {
  Button,
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';
import { flushSync } from 'react-dom';

type Status = 'info' | 'success' | 'warning' | 'error';

// Define the type for your toast content.
export interface RAToastContent {
  icon?: IconProp;
  title: string;
  description?: string | React.ReactNode;
  status?: Status;
  time?: string;
}

// Create a global ToastQueue.
export const queue = new ToastQueue<RAToastContent>({
  // Wrap state updates in a CSS view transition.
  wrapUpdate(fn) {
    if ('startViewTransition' in document) {
      document.startViewTransition(() => {
        flushSync(fn);
      });
    } else {
      fn();
    }
  },
});

export const showToast = (content: RAToastContent, options?: { timeout?: number | null }) => {
  // Add a new toast to the queue.
  if (!content.time) {
    content.time = format(new Date(), 'HH:mm:ss aa');
  }

  // Pass timeout: null to keep the toast persistent (no auto-dismiss).
  const toastOptions: { timeout?: number } =
    options?.timeout === null ? {} : { timeout: options?.timeout ?? 3000 };

  const key = queue.add(content, toastOptions);
  // Return the key for further reference if needed.
  return key;
};

export const showResourceNotFoundToast = (title: string) => {
  showToast(
    {
      icon: 'circle-exclamation',
      title,
      description: 'Please confirm that the resource still exists and has not been deleted or moved.',
      status: 'warning',
    },
    {
      timeout: 5000,
    },
  );
};

const IconBorderStyleMap: Record<Status, string> = {
  info: 'border-(--color-bg)',
  success: 'border-[rgba(var(--color-success-rgb),1)]',
  warning: 'border-[rgba(var(--color-warning-rgb),1)]',
  error: 'border-[rgba(var(--color-danger-rgb),1)]',
};

const StatusIconColorMap: Record<Status, string> = {
  info: 'text-(--color-font)',
  success: 'text-[rgba(var(--color-success-rgb),1)]',
  warning: 'text-[rgba(var(--color-warning-rgb),1)]',
  error: 'text-[rgba(var(--color-danger-rgb),1)]',
};

const StatusIconMap: Record<Status, IconProp> = {
  info: 'info-circle',
  success: 'check-circle',
  warning: 'exclamation-triangle',
  error: 'exclamation-triangle',
};

// Render a <ToastRegion> in the root of your app.
export const Toaster = () => (
  <ToastRegion queue={queue} className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 rounded-lg outline-hidden">
    {({ toast }) => (
      <Toast
        toast={toast}
        style={{ viewTransitionName: toast.key }}
        className={`flex items-center gap-4 rounded-lg border border-solid border-(--hl-sm) bg-(--color-bg) px-3 py-2 text-sm text-(--color-font) shadow-lg outline-hidden [view-transition-name:toast]`}
      >
        <ToastContent className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            {toast.content.icon && (
              <span
                className={`relative flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-(--hl-sm) bg-(--color-bg) text-(--color-font) ${IconBorderStyleMap[toast.content.status || 'info']}`}
              >
                <FontAwesomeIcon icon={toast.content.icon} className="size-5" />
                {toast.content.status && toast.content.status !== 'info' && (
                  <FontAwesomeIcon
                    icon={StatusIconMap[toast.content.status]}
                    className={`absolute right-0 bottom-0 size-3 translate-x-1/2 translate-y-1/2 transform ${StatusIconColorMap[toast.content.status]}`}
                  />
                )}
              </span>
            )}
            <div className="flex w-full flex-col gap-1">
              <Text slot="title" className="flex w-full items-center gap-1">
                <span className="flex-1">{toast.content.title}</span>
                {toast.content.time && <span className="text-xs text-(--hl)">{toast.content.time}</span>}
              </Text>
              {toast.content.description && (
                <Text slot="description" className="max-w-md text-xs">
                  {toast.content.description}
                </Text>
              )}
            </div>
          </div>
        </ToastContent>
        {!toast.timer && (
          <Button
            onPress={() => queue.close(toast.key)}
            aria-label="Dismiss"
            className="ml-1 flex shrink-0 items-center justify-center rounded text-(--hl) transition-opacity hover:opacity-70 focus:outline-none"
          >
            <FontAwesomeIcon icon="xmark" className="size-3" />
          </Button>
        )}
      </Toast>
    )}
  </ToastRegion>
);
