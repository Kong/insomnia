import { services } from 'insomnia-data';
import React, { type FC } from 'react';

import { CONTENT_TYPE_JSON } from '../../../common/constants';
import type { SocketIOEvent, SocketIOMessageEvent } from '../../../main/network/socket-io';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { SocketIOBodyContent } from './body-tab-pane';

interface Props<T> {
  event: T;
}

export const MessageEventView: FC<Props<SocketIOMessageEvent>> = ({ event }) => {
  const stringify = (raw: any) => {
    // If raw is already an object or array, stringify it directly
    if (typeof raw === 'object' && raw !== null) {
      return JSON.stringify(raw, null, '\t');
    }
    // If raw is a string, try to parse and re-stringify for formatting
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return JSON.stringify(parsed, null, '\t');
      } catch {
        return raw;
      }
    }
    // For primitives (number, boolean, etc.), convert to string
    return String(raw);
  };
  const args = event.data.map((item, index) => ({
    id: index.toString(),
    value: stringify(item),
    mode: CONTENT_TYPE_JSON,
  }));

  const { activeRequestMeta, activeResponse } = useRequestLoaderData() as RequestLoaderData;
  const patchRequestMeta = useRequestMetaPatcher();

  const filterHistory = activeRequestMeta.responseFilterHistory || [];
  const filter = activeRequestMeta.responseFilter || '';

  const handleSetFilter = async (responseFilter: string) => {
    if (!activeResponse) {
      return;
    }
    const requestId = activeResponse.parentId;
    await patchRequestMeta(requestId, { responseFilter });
    const meta = await services.requestMeta.getByParentId(requestId);
    if (!meta) {
      return;
    }
    const responseFilterHistory = meta.responseFilterHistory.slice(0, 10);
    // Already in history or empty?
    if (!responseFilter || responseFilterHistory.includes(responseFilter)) {
      return;
    }
    responseFilterHistory.unshift(responseFilter);
    patchRequestMeta(requestId, { responseFilterHistory });
  };

  return (
    <SocketIOBodyContent
      args={args}
      readonly
      filter={filter}
      filterHistory={filterHistory}
      updateFilter={handleSetFilter}
    />
  );
};

export const SocketIOEventView: FC<Props<SocketIOEvent>> = ({ event }) => {
  if (event.type === 'message') {
    return <MessageEventView event={event} />;
  }
  return null;
};
