import React, { FunctionComponent, ReactNode, useCallback, useEffect, useState } from 'react';
import Switch from 'react-switch';
import styled, { css } from 'styled-components';

export interface ToggleSwitchProps {
  labelClassName?: string;
  switchClassName?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange(checked: boolean, arg1: Event, arg2: string): void | Promise<void>;
  label?: ReactNode;
}

const ThemedSwitch = styled(Switch)<{ checked: boolean }>`
  .react-switch-bg {
    background: ${({ checked }) => (checked ? 'var(--color-surprise)' : 'var(--hl-xl)')} !important;
    
    ${({ checked }) => checked && css`
    path {
      fill: var(--color-font-surprise) !important
    }
    `}
  }

  vertical-align: middle;
`;

const StyledLabel = styled.label`
  display: inline-flex;
  flex-direction: row;
  align-items: center;

  span {
    margin-left: var(--padding-md);
  }
`;

export const ToggleSwitch: FunctionComponent<ToggleSwitchProps> = ({
  labelClassName,
  switchClassName = '',
  checked: checkedProp,
  onChange,
  disabled,
  label,
  ...props
}) => {
  const [checked, setChecked] = useState(Boolean(checkedProp));

  // If prop changes and differs from state, update state
  useEffect(() => {
    setChecked(Boolean(checkedProp));
  }, [checkedProp]);

  const callback = useCallback((c, a, b) => {
    setChecked(c);
    onChange(c, a, b);
  }, [onChange]);

  const toggle = (
    <ThemedSwitch
      className={switchClassName}
      checked={checked}
      disabled={disabled}
      onChange={callback}
      height={20}
      width={40}
      {...(props as Record<string, any>)}
    />
  );

  if (label) {
    return (
      <StyledLabel className={labelClassName}>
        {toggle}
        <span>{label}</span>
      </StyledLabel>
    );
  } else {
    return toggle;
  }
};
