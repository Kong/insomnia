// @flow
import React from 'react';
import { Pane, PaneBody, PaneHeader } from './pane';
import { Button } from 'insomnia-components';
import * as grpc from '../../../network/grpc';
import type { Request } from '../../../models/request';
import type { GrpcRequest } from '../../../models/grpc-request';

type Props = {
  activeRequest: Request | GrpcRequest,
};

const GrpcRequestPane = ({ activeRequest }: Props) => {
  return (
    <Pane type="request">
      <PaneHeader>
        <Button onClick={() => grpc.sendUnary(activeRequest._id)}>send unary</Button>
      </PaneHeader>
      <PaneBody />
    </Pane>
  );
};

export default GrpcRequestPane;
