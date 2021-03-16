// @flow
import * as React from 'react';
import Switch from 'react-switch';
import styled from 'styled-components';

type Props = {
  className?: string,
  checked?: boolean,
  disabled?: boolean,
  onChange(checked: boolean): void | Promise<void>,
};

const ThemedSwitch: React.ComponentType<{ checked: boolean }> = styled.div`
  .react-switch-bg {
    background: ${({ checked }) => (checked ? 'var(--color-surprise)' : 'var(--hl-xl)')} !important;
  }
`;

const ToggleSwitch: React.StatelessFunctionalComponent<Props> = ({
  className,
  checked: checkedProp,
  onChange,
  disabled,
}) => {
  const [checked, setChecked] = React.useState(!!checkedProp);

  // If prop changes and differs from state, update state
  React.useEffect(() => {
    setChecked(!!checkedProp);
  }, [checkedProp]);

  const callback = React.useCallback(
    c => {
      setChecked(c);
      onChange(c);
    },
    [onChange],
  );

  return (
    <ThemedSwitch checked={checked}>
      <Switch
        className={className}
        checked={checked}
        disabled={disabled}
        onChange={callback}
        height={20}
        width={40}
      />
    </ThemedSwitch>
  );
};

export default ToggleSwitch;
