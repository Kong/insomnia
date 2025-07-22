import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import {
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';
import { flushSync } from 'react-dom';

type Status = 'info' | 'success' | 'warning' | 'error';

// Define the type for your toast content.
interface RAToastContent {
  icon?: IconProp;
  title: string;
  description?: string;
  status?: Status;
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

export const showToast = (content: RAToastContent, options?: { timeout?: number }) => {
  // Add a new toast to the queue.
  const key = queue.add(content, {
    timeout: options?.timeout ?? 3000,
  });

  // Return the key for further reference if needed.
  return key;
};

const classNameMap: Record<Status, string> = {
  info: 'bg-[--color-bg] text-[--color-font]',
  success: 'bg-[rgba(var(--color-success-rgb),1)] text-[--color-font-success]',
  warning: 'bg-[rgba(var(--color-warning-rgb),1)] text-[--color-font-warning]',
  error: 'bg-[rgba(var(--color-danger-rgb),1)] text-[--color-font-danger]',
};

// Render a <ToastRegion> in the root of your app.
export const Toaster = () => (
  <ToastRegion queue={queue} className="fixed bottom-4 right-4 flex flex-col gap-2 rounded-lg outline-none">
    {({ toast }) => (
      <Toast
        toast={toast}
        style={{ viewTransitionName: toast.key }}
        className={`flex items-center gap-4 rounded-lg border border-solid border-[--hl-sm] px-3 py-2 text-sm shadow-lg outline-none ${classNameMap[toast.content.status || 'info']} [view-transition-name:toast]`}
      >
        <ToastContent className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            {toast.content.icon && <FontAwesomeIcon icon={toast.content.icon} />}
            <div className="flex flex-col gap-1">
              <Text slot="title">{toast.content.title}</Text>
              {toast.content.description && <Text slot="description">{toast.content.description}</Text>}
            </div>
          </div>
        </ToastContent>
      </Toast>
    )}
  </ToastRegion>
);
