import React, { FunctionComponent } from 'react';
import { Tooltip } from 'insomnia-components';
import type { GrpcMethodType } from '../../../network/grpc/method';
import { GrpcMethodTypeAcronym, GrpcMethodTypeName } from '../../../network/grpc/method';
import styled from 'styled-components';

interface Props {
  methodType: GrpcMethodType;
}

const StyledTag = styled.div`
  width: 1.5em;
  text-align: right;
`;

const GrpcMethodTag: FunctionComponent<Props> = ({ methodType }) => (
  <Tooltip message={GrpcMethodTypeName[methodType]} position="left" delay={500}>
    <StyledTag>
      <em>{GrpcMethodTypeAcronym[methodType]}</em>
    </StyledTag>
  </Tooltip>
);

export default GrpcMethodTag;
