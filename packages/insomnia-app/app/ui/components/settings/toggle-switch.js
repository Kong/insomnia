// @flow
import * as React from 'react';

type Props = {
  name: string,
  checked: boolean,
  onChange(e: SyntheticEvent<HTMLInputElement>): void,
};

const ToggleSwitch: React.FC<Props> = ({ name, checked: checkedProp, onChange }) => {
  const [checkedState, setChecked] = React.useState(checkedProp);

  React.useEffect(() => {
    if (checkedState !== checkedProp) {
      setChecked(checkedProp);
    }
  }, [checkedProp]);

  return (
    <label className="switch no-pad-top">
      <input
        type="checkbox"
        name={name}
        checked={checkedState}
        onChange={e => {
          console.log('Trigger change', e);
          setChecked(!checkedProp);
          onChange(e);
        }}
      />
      <span className="slider" />
    </label>
  );
};

export default ToggleSwitch;
