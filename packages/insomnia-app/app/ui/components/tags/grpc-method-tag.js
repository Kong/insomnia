// @flow
import React from 'react';
import { Tooltip } from 'insomnia-components';

import type { GrpcMethodType } from '../../../network/grpc/method';
import { GrpcMethodTypeAcronym, GrpcMethodTypeName } from '../../../network/grpc/method';
import styled from 'styled-components';

type Props = {
  methodType: GrpcMethodType,
};

const StyledTag = styled.div`
  width: 1.5em;
  text-align: center;
  background: #2fa3a3;
  color: white;
  border-radius: 3px;
  border: 1px solid #267d7d !important;
  padding: 0 var(--padding-xs);
`;

const GrpcMethodTag = ({ methodType }: Props) => (
  <Tooltip message={GrpcMethodTypeName[methodType]} position="left" delay={500}>
    <StyledTag>{GrpcMethodTypeAcronym[methodType]}</StyledTag>
  </Tooltip>
);

export default GrpcMethodTag;
