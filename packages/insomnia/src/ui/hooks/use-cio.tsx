import type { AnalyticsBrowser } from '@customerio/cdp-analytics-browser';
import { useEffect, useRef } from 'react';

import { getCioSiteId, getCioWriteKey } from '~/common/constants';
import { useRootLoaderData } from '~/root';

// Global singleton
let globalAnalyticsInstance: AnalyticsBrowser | null = null;
let isInitializing = false;
let pendingIdentify: (() => void) | null = null;
// The raw accountId of the currently identified user, or null when anonymous.
// We only send Customer.io events for identified users so we never create
// anonymous, email-less profiles (INS-2678).
let identifiedUserId: string | null = null;

/**
 * Track an event directly through the Customer.io browser SDK, tied to the
 * already-identified user (keyed by the raw accountId used in `identify`).
 *
 * No-ops for anonymous users and before the SDK has initialized/identified, so
 * it can never create email-less Customer.io profiles. This is intentionally
 * separate from the Segment `track()` pipeline in `main/analytics.ts`.
 */
export function trackCioEvent(event: string, properties?: Record<string, unknown>): void {
  if (!globalAnalyticsInstance || !identifiedUserId) {
    return;
  }
  globalAnalyticsInstance.track(event, properties);
}

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

    // Logged out (or not yet logged in): clear any prior Customer.io identity so
    // later events aren't attributed to the previous account (INS-2678).
    if (!currentUserId) {
      // A queued identify must be dropped too, otherwise logging out before the
      // SDK finishes initializing would re-identify the previous user once it
      // loads. Always clear the markers; only reset the SDK if there was an
      // active or queued identity to clear.
      const hadIdentity = Boolean(pendingIdentify || lastIdentifiedUser.current || identifiedUserId);
      if (hadIdentity) {
        globalAnalyticsInstance?.reset();
      }
      lastIdentifiedUser.current = null;
      identifiedUserId = null;
      pendingIdentify = null;
      return;
    }

    if (currentUserId === lastIdentifiedUser.current) {
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
      identifiedUserId = currentUserId;
    };

    if (globalAnalyticsInstance) {
      identifyCall();
    } else {
      pendingIdentify = identifyCall;
    }
  }, [userSession?.accountId, userSession?.email, userSession?.firstName, userSession?.lastName]);

  return globalAnalyticsInstance;
};
