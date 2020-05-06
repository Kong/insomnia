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
    background: ${({ checked }) => (checked ? 'var(--color-surprise)' : 'var(--hl-xl)')};
  }
`;

type State = {
  checked: boolean,
};

class ToggleSwitch extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { checked: props.checked || false };
  }

  setChecked(checked: boolean) {
    this.setState({ checked });
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
      <ThemedSwitch checked={checked}>
        <Switch
          className={className}
          checked={checked}
          onColor="" // Linked to insomnia themes via ThemedSwitch
          offColor="" // Linked to insomnia themes via ThemedSwitch
          disabled={disabled}
          onChange={c => {
            this.setChecked(c);
            onChange(c);
          }}
          height={20}
          width={40}
        />
      </ThemedSwitch>
    );
  }
}

export default ToggleSwitch;
