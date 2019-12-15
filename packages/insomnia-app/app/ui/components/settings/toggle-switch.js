// @flow
import * as React from 'react';
import Switch from 'react-switch';

type Props = {
  name: string,
  checked: boolean,
  disabled?: boolean,
  onChange(name: string, checked: boolean): void,
};

const ToggleSwitch: React.FunctionComponent<Props> = ({
  name,
  checked: checkedProp,
  onChange,
  disabled,
}) => {
  const [checked, setChecked] = React.useState(checkedProp);

  // If prop changes and differs from state, update state
  React.useEffect(() => {
    if (checked !== checkedProp) {
      setChecked(checkedProp);
    }
  }, [checkedProp]);

  return (
    <label>
      <Switch
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={c => {
          setChecked(c);
          onChange(name, c);
        }}
        height={20}
        width={40}
      />
    </label>
  );
};

export default ToggleSwitch;
