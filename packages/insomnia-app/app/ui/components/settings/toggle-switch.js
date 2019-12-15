// @flow
import React from 'react';
import { Switch } from 'react-switch';

type Props = {
  className?: string,
  checked?: boolean,
  disabled?: boolean,
  onChange(checked: boolean): void,
};

function ToggleSwitch({ className, checked: checkedProp, onChange, disabled }: Props) {
  const [checked, setChecked] = React.useState(checkedProp);

  // If prop changes and differs from state, update state
  React.useEffect(() => {
    if (checked !== checkedProp) {
      setChecked(checkedProp);
    }
  }, [checkedProp]);

  return (
    <Switch
      className={className}
      checked={checked}
      disabled={disabled}
      onChange={c => {
        setChecked(c);
        onChange(c);
      }}
      height={20}
      width={40}
    />
  );
}

export default ToggleSwitch;
