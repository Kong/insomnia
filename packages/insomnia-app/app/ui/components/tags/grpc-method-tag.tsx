import { Tooltip } from 'insomnia-components';
import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

import type { GrpcMethodType } from '../../../network/grpc/method';
import { GrpcMethodTypeAcronym, GrpcMethodTypeName } from '../../../network/grpc/method';

interface Props {
  methodType: GrpcMethodType;
}

const StyledTag = styled.div`
  width: 1.5em;
  text-align: right;
`;

export const GrpcMethodTag: FunctionComponent<Props> = ({ methodType }) => (
  <Tooltip message={GrpcMethodTypeName[methodType]} position="left" delay={500}>
    <StyledTag>
      <em>{GrpcMethodTypeAcronym[methodType]}</em>
    </StyledTag>
  </Tooltip>
);
