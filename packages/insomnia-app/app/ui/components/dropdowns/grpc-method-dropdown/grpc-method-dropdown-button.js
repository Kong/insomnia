// @flow
import React from 'react';
import styled from 'styled-components';
import { getGrpcPathSegments } from '../../../../common/grpc-paths';
import { Button, Tooltip } from 'insomnia-components';

const SpaceBetween = styled.span`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

type Props = { fullPath?: string };

const useLabel = (fullPath: string): string =>
  React.useMemo(() => {
    if (fullPath) {
      const { packageName, serviceName, methodName } = getGrpcPathSegments(fullPath);
      return packageName && serviceName && methodName ? `${serviceName}/${methodName}` : fullPath;
    }

    return 'Select Method';
  }, [fullPath]);

const GrpcMethodDropdownButton = ({ fullPath }: Props) => (
  <Button className="tall wide" variant="text" size="medium" radius="0">
    <Tooltip className="tall wide" message={fullPath} position="bottom" delay={500}>
      <SpaceBetween>
        {useLabel(fullPath)}
        <i className="fa fa-caret-down pad-left-sm" />
      </SpaceBetween>
    </Tooltip>
  </Button>
);

export default GrpcMethodDropdownButton;
