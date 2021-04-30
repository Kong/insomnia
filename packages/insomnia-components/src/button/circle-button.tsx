import React, { FunctionComponent } from 'react';
import styled, { css } from 'styled-components';
import { Button } from './button';
import type { ButtonProps } from './button';

export interface CircleButtonProps extends ButtonProps {
  height?: string;
  width?: string;
}

const StyledCircleButton = styled(Button)<CircleButtonProps>`
  padding: unset;
  font-size: var(--font-size-xl);
  border-radius: 50%;

  ${({ height }) => css`
    height: ${height || css`var(--line-height-xs)`};
  `};

  ${({ width }) => css`
    width: ${width || css`var(--line-height-xs)`};
  `};

  svg {
    padding: var(--padding-xs);
  }
`;

export const CircleButton: FunctionComponent<CircleButtonProps> = props => <StyledCircleButton {...props} />;
