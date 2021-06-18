import React, { HTMLAttributes, PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';

interface Props extends HTMLAttributes<HTMLInputElement> {
  indeterminate: boolean;
  checked: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class IndeterminateCheckbox extends PureComponent<Props> {
  input: HTMLInputElement | null = null;

  _setRef(n: HTMLInputElement) {
    this.input = n;
  }

  _update() {
    if (this.input) {
      this.input.indeterminate = this.props.indeterminate;
    }
  }

  componentDidMount() {
    this._update();
  }

  componentDidUpdate() {
    this._update();
  }

  render() {
    const {
      indeterminate,
      ...otherProps
    } = this.props;
    return <input ref={this._setRef} type="checkbox" {...otherProps} />;
  }
}

export default IndeterminateCheckbox;
