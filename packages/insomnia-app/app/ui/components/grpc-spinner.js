// @flow
import React from 'react';
import classnames from 'classnames';
import { useGrpcRequestState } from '../context/grpc';

type Props = {
  className?: string,
  requestId: string,
};

const GrpcSpinner = ({ className, requestId }: Props) => {
  const { running } = useGrpcRequestState(requestId);

  return running && <i className={classnames('fa fa-refresh fa-spin', className)} />;
};

export default GrpcSpinner;
