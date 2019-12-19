// @flow
import * as React from 'react';
import Switch from 'react-switch';

type Props = {
  className?: string,
  checked?: boolean,
  disabled?: boolean,
  onChange(checked: boolean): void | Promise<void>,
};

type State = {
  checked: boolean,
};

class ToggleSwitch extends React.PureComponent<Props, State> {
  _mounted: boolean;

  constructor(props: Props) {
    super(props);

    this.state = { checked: props.checked || false };
  }

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  setChecked(checked: boolean) {
    if (this._mounted) {
      this.setState({ checked });
    }
  }

  componentWillReceiveProps(newProps: Props) {
    if (newProps.checked === this.props.checked) {
      return;
    }

    const newChecked = newProps.checked || false;

    if (this.state.checked !== newChecked) {
      this.setChecked(newChecked);
    }
  }

  render() {
    const { checked } = this.state;
    const { className, disabled, onChange } = this.props;

    return (
      <Switch
        className={className}
        checked={checked}
        disabled={disabled}
        onChange={c => {
          this.setChecked(c);
          onChange(c);
        }}
        height={20}
        width={40}
      />
    );
  }
}

export default ToggleSwitch;
