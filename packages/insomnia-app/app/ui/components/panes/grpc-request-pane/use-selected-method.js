// @flow
import React from 'react';
import type { GrpcMethodDefinition, GrpcMethodType } from '../../../../network/grpc/method';
import {
  canClientStream,
  getMethodType,
  GrpcMethodTypeName,
} from '../../../../network/grpc/method';
import type { GrpcRequest } from '../../../../models/grpc-request';
import type { GrpcRequestState } from '../../../context/grpc';

type MethodSelection = {
  method?: GrpcMethodDefinition,
  methodType?: GrpcMethodType,
  methodTypeLabel?: string,
  enableClientStream?: boolean,
};

const useSelectedMethod = (
  { methods, reloadMethods }: GrpcRequestState,
  { _id, protoMethodName }: GrpcRequest,
): MethodSelection => {
  const [selection, setSelection] = React.useState({});

  // if methods are waiting to be reloaded because they are stale, don't update the method selection.
  //  This is a bit of a hack needed to avoid a split-second blank state showing on the page because
  //  component refreshes are also triggered by database changes and before the methods have been updated.
  React.useEffect(() => {
    if (reloadMethods) {
      return;
    }

    const selectedMethod = methods.find(c => c.path === protoMethodName);

    const methodType = selectedMethod && getMethodType(selectedMethod);
    const methodTypeLabel = GrpcMethodTypeName[methodType];
    const enableClientStream = canClientStream(methodType);

    setSelection({ method: selectedMethod, methodType, methodTypeLabel, enableClientStream });
  }, [methods, protoMethodName, reloadMethods]);

  return selection;
};

export default useSelectedMethod;
