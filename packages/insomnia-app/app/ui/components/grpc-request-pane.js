// @flow
import React from 'react';
import type { Request } from '../../models/request';
import type { GrpcRequest } from '../../models/grpc-request';
import * as grpc from '../../network/grpc';
import { Button } from 'insomnia-components';

type Props = {
  activeRequest: Request | GrpcRequest,
};

const paneClasses = 'request-pane theme--pane pane';
const paneHeaderClasses = 'pane__header theme--pane__header';
const paneBodyClasses = 'pane__body theme--pane__body';

const GrpcRequestPane = ({ activeRequest }: Props) => {
  return (
    <section className={paneClasses}>
      <header className={paneHeaderClasses}>
        <Button onClick={() => grpc.sendUnary(activeRequest._id)}>send unary</Button>
      </header>
      <div className={paneBodyClasses}></div>
    </section>
  );
};

export default GrpcRequestPane;
