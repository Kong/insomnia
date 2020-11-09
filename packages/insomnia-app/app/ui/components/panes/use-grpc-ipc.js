// @flow
import React from 'react';
import type { GrpcRequestEvent } from '../../../common/grpc-events';
import { ipcRenderer } from 'electron';

export const useGrpcIpc: string => GrpcRequestEvent => void = requestId =>
  React.useCallback((channel: GrpcRequestEvent) => ipcRenderer.send(channel, requestId), [
    requestId,
  ]);
