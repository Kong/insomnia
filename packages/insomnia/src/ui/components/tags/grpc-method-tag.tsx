import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

import type { GrpcMethodType } from '../../../main/ipc/grpc';
import { GrpcMethodTypeName } from '../panes/grpc-request-pane';
import { Tooltip } from '../tooltip';

interface Props {
  methodType: GrpcMethodType;
}

const StyledTag = styled.div`
  width: 1.5em;
  text-align: right;
`;
const GrpcMethodTypeAcronym = {
  unary: 'U',
  server: 'SS',
  client: 'CS',
  bidi: 'BD',
} as const;

export const GrpcMethodTag: FunctionComponent<Props> = ({ methodType }) => (
  <Tooltip message={GrpcMethodTypeName[methodType]} position="left" delay={500}>
    <StyledTag>
      <em>{GrpcMethodTypeAcronym[methodType]}</em>
    </StyledTag>
  </Tooltip>
);
