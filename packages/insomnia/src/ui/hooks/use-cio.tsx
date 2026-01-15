import type { AnalyticsBrowser } from '@customerio/cdp-analytics-browser';
import { useEffect, useRef } from 'react';

import { getCioSiteId, getCioWriteKey } from '~/common/constants';
import { useRootLoaderData } from '~/root';

// Global singleton
let globalAnalyticsInstance: AnalyticsBrowser | null = null;
let isInitializing = false;
let pendingIdentify: (() => void) | null = null;

export const useCio = () => {
  const { userSession } = useRootLoaderData()!;
  const lastIdentifiedUser = useRef<string | null>(null);

  // Initialize SDK once
  useEffect(() => {
    if (globalAnalyticsInstance || isInitializing) {
      return;
    }

    isInitializing = true;
    console.log('[CIO] Initializing SDK...');

    import('@customerio/cdp-analytics-browser')
      .then(({ AnalyticsBrowser }) => {
        globalAnalyticsInstance = AnalyticsBrowser.load(
          {
            cdnURL: 'https://cdp-eu.customer.io',
            writeKey: getCioWriteKey(),
          },
          {
            integrations: {
              'Customer.io In-App Plugin': {
                siteId: getCioSiteId(),
                // _logging: true,
                events: {
                  handleEvent(e: Event) {
                    console.log('[CIO] Event', e.type, (e as CustomEvent).detail);
                  },
                } as any, // The interface of the events is incorrect, see: https://docs.customer.io/integrations/data-in/connections/javascript/js-source/#import-the-javascript-client
              },
            },
          },
        );
        console.log('[CIO] SDK initialized successfully');

        // Execute pending identify
        if (pendingIdentify) {
          pendingIdentify();
          pendingIdentify = null;
        }
      })
      .catch(err => {
        console.error('[CIO] Failed to load SDK:', err);
      })
      .finally(() => {
        isInitializing = false;
      });
  }, []);

  // Handle user identification
  useEffect(() => {
    const currentUserId = userSession?.accountId;
    if (!currentUserId || currentUserId === lastIdentifiedUser.current) {
      return;
    }

    const identifyCall = () => {
      globalAnalyticsInstance?.identify(currentUserId, {
        email: userSession.email,
        first_name: userSession.firstName,
        last_name: userSession.lastName,
      });
      globalAnalyticsInstance?.page();
      lastIdentifiedUser.current = currentUserId;
    };

    if (globalAnalyticsInstance) {
      identifyCall();
    } else {
      pendingIdentify = identifyCall;
    }
  }, [userSession?.accountId, userSession?.email, userSession?.firstName, userSession?.lastName]);

  return globalAnalyticsInstance;
};
