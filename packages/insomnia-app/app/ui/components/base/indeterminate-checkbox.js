// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';

type Props = {
  indeterminate: boolean,
  checked: boolean,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class IndeterminateCheckbox extends React.PureComponent<Props> {
  input: ?HTMLInputElement;

  _setRef(n: ?HTMLInputElement) {
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
      indeterminate, // eslint-disable-line no-unused-vars
      ...otherProps
    } = this.props;

    return <input ref={this._setRef} type="checkbox" {...(otherProps: Object)} />;
  }
}

export default IndeterminateCheckbox;
