// @flow

import type { Schema } from '@develohpanda/fluent-builder';
import type { GrpcRequestState } from '../grpc-reducer';

export const requestStateSchema: Schema<GrpcRequestState> = {
  running: () => false,
  requestMessages: () => [],
  responseMessages: () => [],
  status: () => undefined,
  error: () => undefined,
  methods: () => [],
  reloadMethods: () => false,
};
