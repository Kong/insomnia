// @flow
import * as React from 'react';

type Props = {
  children: React.Node
};

class Wrap extends React.PureComponent<Props> {
  render() {
    return this.props.children;
  }
}

export default Wrap;
