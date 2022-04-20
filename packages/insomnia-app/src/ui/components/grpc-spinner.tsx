import classnames from 'classnames';
import React, { FunctionComponent } from 'react';

import { useGrpcRequestState } from '../context/grpc';

interface Props {
  className?: string;
  requestId: string;
}

export const GrpcSpinner: FunctionComponent<Props> = ({ className, requestId }) => {
  const { running } = useGrpcRequestState(requestId);
  return running ? <i className={classnames('fa fa-refresh fa-spin', className)} /> : null;
};
