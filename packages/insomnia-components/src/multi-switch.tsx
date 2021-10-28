import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

import type { RadioButtonGroupProps } from './radio-button-group';
import { RadioButtonGroup } from './radio-button-group';

const ThemedButtonGroup = styled(RadioButtonGroup)<RadioButtonGroupProps>`
  font-weight: 500;
  background: var(--hl-xs);
  color: var(--color-font);
  border: 0;
  border-radius: 100px;
  align-content: space-evenly;
  padding: var(--padding-xxs);
  transform: scale(0.9);
  transformOrigin: 'center';

  label {
    padding: 0;
  }

  span {
    text-transform: uppercase;
    padding: var(--padding-xs) var(--padding-xxs);
    color: var(--hl);
    background: transparent;
    font-size: var(--font-size-xs);
    margin: 0 auto;
    min-width: 4rem;
  }

  input:checked + span {
    color: var(--color-font);
    background: var(--color-bg);
  }
`;

export const MultiSwitch: FunctionComponent<RadioButtonGroupProps> = props => <ThemedButtonGroup {...props} />;
