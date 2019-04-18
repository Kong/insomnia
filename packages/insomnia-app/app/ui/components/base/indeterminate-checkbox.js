// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';

type Props = {
  indeterminate: boolean,
};

@autobind
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

    return <input ref={this._setRef} type="checkbox" {...otherProps} />;
  }
}

export default IndeterminateCheckbox;
