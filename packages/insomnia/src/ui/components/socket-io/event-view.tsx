import React, { type FC } from 'react';

import { CONTENT_TYPE_JSON } from '../../../common/constants';
import type { SocketIOEvent, SocketIOMessageEvent } from '../../../main/network/socket-io';
import { SocketIOBodyContent } from './body-tab-pane';

interface Props<T> {
  event: T;
}

export const MessageEventView: FC<Props<SocketIOMessageEvent>> = ({ event }) => {
  const stringify = (raw: any) => {
    return JSON.stringify(raw, null, '\t');
  };
  const args = event.data.map((item, index) => ({
    id: index.toString(),
    value: stringify(item),
    mode: CONTENT_TYPE_JSON,
  }));
  console.log(args);

  return (
    <SocketIOBodyContent
      args={args}
      readonly
    />
  );
};

export const SocketIOEventView: FC<Props<SocketIOEvent>> = ({ event }) => {
  if (event.type === 'message') {
    return <MessageEventView event={event} />;
  }
  return null;
};
