import React, { type FC } from 'react';
import { useRouteLoaderData } from 'react-router';

import { CONTENT_TYPE_JSON } from '../../../common/constants';
import type { SocketIOEvent, SocketIOMessageEvent } from '../../../main/network/socket-io';
import * as models from '../../../models';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import type { RequestLoaderData } from '../../routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { SocketIOBodyContent } from './body-tab-pane';

interface Props<T> {
  event: T;
}

export const MessageEventView: FC<Props<SocketIOMessageEvent>> = ({ event }) => {
  const stringify = (raw: any) => {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, '\t');
    } catch (err) {
      return raw;
    }
  };
  const args = event.data.map((item, index) => ({
    id: index.toString(),
    value: stringify(item),
    mode: CONTENT_TYPE_JSON,
  }));

  const { activeRequestMeta, activeResponse } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchRequestMeta = useRequestMetaPatcher();

  const filterHistory = activeRequestMeta.responseFilterHistory || [];
  const filter = activeRequestMeta.responseFilter || '';

  const handleSetFilter = async (responseFilter: string) => {
    if (!activeResponse) {
      return;
    }
    const requestId = activeResponse.parentId;
    await patchRequestMeta(requestId, { responseFilter });
    const meta = await models.requestMeta.getByParentId(requestId);
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
