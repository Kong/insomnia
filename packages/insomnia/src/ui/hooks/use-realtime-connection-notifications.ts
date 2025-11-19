import { useCallback, useEffect, useState } from 'react';

import { REALTIME_EVENTS_CHANNELS } from '~/common/constants';
import type { McpEvent } from '~/main/mcp/types';

type McpNotification = Extract<McpEvent, { type: 'notification' }>;
export function useRealtimeConnectionNotifications({
  responseId,
  protocol,
}: {
  responseId: string;
  protocol: 'curl' | 'webSocket' | 'socketIO' | 'mcp';
}) {
  const [notifications, setNotifications] = useState<McpNotification[]>([]);
  const updateEvents = useCallback(async () => {
    if (protocol === 'mcp') {
      // only mcp has notifications for now
      const notifications = await window.main[protocol].event.findNotifications({ responseId });
      setNotifications(notifications);
    }
  }, [protocol, responseId]);

  useEffect(() => {
    updateEvents();
  }, [updateEvents]);

  useEffect(() => {
    // @ts-expect-error -- we use a dynamic channel here
    const unsubscribe = window.main.on(`${protocol}.${responseId}.${REALTIME_EVENTS_CHANNELS.MCP_NOTIFICATION}`, () => {
      updateEvents();
    });
    return () => {
      unsubscribe();
    };
  }, [protocol, responseId, updateEvents]);

  return notifications;
}
