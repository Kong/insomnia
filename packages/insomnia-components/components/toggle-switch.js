// @flow
import * as React from 'react';
import Switch from 'react-switch';
import styled from 'styled-components';

type Props = {
  labelClassName?: string,
  switchClassName?: string,
  checked?: boolean,
  disabled?: boolean,
  onChange(checked: boolean, Event, string): void | Promise<void>,
  label?: React.Node,
};

const ThemedSwitch: React.ComponentType<{ checked: boolean }> = styled(Switch)`
  .react-switch-bg {
    background: ${({ checked }) => (checked ? 'var(--color-surprise)' : 'var(--hl-xl)')} !important;
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

const ToggleSwitch: React.StatelessFunctionalComponent<Props> = ({
  labelClassName,
  switchClassName,
  checked: checkedProp,
  onChange,
  disabled,
  label,
  ...props
}) => {
  const [checked, setChecked] = React.useState(!!checkedProp);

  // If prop changes and differs from state, update state
  React.useEffect(() => {
    setChecked(!!checkedProp);
  }, [checkedProp]);

  const callback = React.useCallback(
    (c, a, b) => {
      setChecked(c);
      onChange(c, a, b);
    },
    [onChange],
  );

  const toggle = (
    <ThemedSwitch
      className={switchClassName}
      checked={checked}
      disabled={disabled}
      onChange={callback}
      height={20}
      width={40}
      {...(props: Object)}
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

export default ToggleSwitch;
