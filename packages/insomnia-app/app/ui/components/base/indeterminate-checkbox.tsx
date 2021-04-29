import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
type Props = {
  indeterminate: boolean;
  checked: boolean;
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class IndeterminateCheckbox extends React.PureComponent<Props> {
  input: HTMLInputElement | null | undefined;

  _setRef(n: HTMLInputElement | null | undefined) {
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
      // eslint-disable-line no-unused-vars
      ...otherProps
    } = this.props;
    return <input ref={this._setRef} type="checkbox" {...(otherProps as Record<string, any>)} />;
  }
}

export default IndeterminateCheckbox;
