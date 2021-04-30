import React, { FunctionComponent } from 'react';
import styled from 'styled-components';
import type { RadioButtonGroupProps } from './radio-button-group';
import { RadioButtonGroup } from './radio-button-group';

const ThemedButtonGroup = styled(RadioButtonGroup)<RadioButtonGroupProps>`
  font-weight: bold;
  background: var(--hl-xs);
  color: var(--color-font);
  border: 0;
  border-radius: 100px;
  align-content: space-evenly;

  label {
    padding: 0;
  }

  span {
    text-transform: uppercase;
    padding: var(--padding-xxs) var(--padding-md);
    color: var(--hl);
    background: transparent;
    font-size: var(--font-size-sm);
    margin: 0 auto;
    min-width: 4rem;
  }

  input:checked + span {
    color: var(--color-font);
    text-shadow: 0 1px rgba(255, 255, 255, 0.25);
    background: var(--color-bg);
  }
`;

export const MultiSwitch: FunctionComponent<RadioButtonGroupProps> = props => <ThemedButtonGroup {...props} />;
