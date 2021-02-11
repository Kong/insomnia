// @flow

import * as React from 'react';
import styled, { css } from 'styled-components';
import { Button } from './button';
import type { ButtonProps } from './button';

type Props = {
  height?: string,
  width?: string,
} & ButtonProps;

const StyledCircleButton: React.ComponentType<Props> = styled(Button)`
  padding: unset;
  font-size: var(--font-size-xl);
  border-radius: 50%;

  ${({ height }) => css`
    height: ${height || 'unset'};
  `};

  ${({ width }) => css`
    width: ${width || 'unset'};
  `};

  svg {
    padding: var(--padding-xs);
  }
`;

export const CircleButton = (props: Props) => <StyledCircleButton {...props} />;
