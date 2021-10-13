import { Button, ButtonProps, Tooltip } from 'insomnia-components';
import React, { FunctionComponent, useMemo } from 'react';
import styled from 'styled-components';

import { getGrpcPathSegments, getShortGrpcPath } from '../../../../common/grpc-paths';

const FlexSpaceBetween = styled.span`
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

interface Props {
  fullPath?: string;
}

const useLabel = (fullPath?: string) =>
  useMemo(() => {
    if (fullPath) {
      const segments = getGrpcPathSegments(fullPath);
      return getShortGrpcPath(segments, fullPath);
    }

    return 'Select Method';
  }, [fullPath]);

const buttonProps: ButtonProps = {
  className: 'tall wide',
  variant: 'text',
  size: 'medium',
  radius: '0',
};

export const GrpcMethodDropdownButton: FunctionComponent<Props> = ({ fullPath }) => (
  <Button {...buttonProps}>
    <Tooltip className="tall wide" message={fullPath} position="bottom" delay={500}>
      <FlexSpaceBetween>
        {useLabel(fullPath)}
        <i className="fa fa-caret-down pad-left-sm" />
      </FlexSpaceBetween>
    </Tooltip>
  </Button>
);
