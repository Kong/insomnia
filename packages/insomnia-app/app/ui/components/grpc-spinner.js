// @flow
import React from 'react';
import { useGrpcState } from '../context/grpc/grpc-context';
import { findGrpcRequestState } from '../context/grpc/grpc-reducer';
import classnames from 'classnames';

type Props = {
  className?: string,
  requestId: string,
};

const GrpcSpinner = ({ className, requestId }: Props) => {
  const grpcState = useGrpcState();
  const { running } = findGrpcRequestState(grpcState, requestId);

  return running && <i className={classnames('fa fa-refresh fa-spin', className)} />;
};

export default GrpcSpinner;
