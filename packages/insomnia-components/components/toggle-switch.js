// @flow
import * as React from 'react';
import Switch from 'react-switch';

type Props = {
  className?: string,
  checked?: boolean,
  disabled?: boolean,
  onChange(checked: boolean): void | Promise<void>,
};

const ToggleSwitch: React.FC<Props> = ({ className, checked: checkedProp, onChange, disabled }) => {
  const [checked, setChecked] = React.useState(checkedProp);

  // If prop changes and differs from state, update state
  React.useEffect(() => {
    setChecked(checkedProp);
  }, [checkedProp]);

  const callback = React.useCallback(
    c => {
      setChecked(c);
      onChange(c);
    },
    [onChange],
  );

  return (
    <Switch
      className={className}
      checked={checked}
      disabled={disabled}
      onChange={callback}
      height={20}
      width={40}
    />
  );
};

export default ToggleSwitch;
