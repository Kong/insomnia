// @flow

// THIS IS TEMPORARY. This will be replaced with a React Context implementation.

import React from 'react';
import { ipcRenderer } from 'electron';
import { GrpcResponseEventEnum } from '../../../common/grpc-events';

type Props = {};

const GrpcEventWrapper = ({ children }: Props) => {
  // const [requests, setRequests] = React.useState();
  // const [responses, setResponses] = React.useState();

  // Only add listeners on mount
  React.useEffect(() => {
    // TODO: Do we need to clear listeners or will they overwrite?
    ipcRenderer.on(GrpcResponseEventEnum.data, (_, requestId, val) => {
      console.log(val);
    });

    ipcRenderer.on(GrpcResponseEventEnum.err, (_, requestId, err) => {
      console.error(err);
    });
  }, []);

  return children;
};

export default GrpcEventWrapper;
