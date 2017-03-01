import React, {PureComponent, PropTypes} from 'react';

class Lazy extends PureComponent {
  constructor (props) {
    super(props);

    if (props.delay <= 0) {
      // No delay
      this.state = {show: true};
    } else {
      this.state = {show: false};
    }
  }

  componentDidMount () {
    if (this.state.show) {
      // Not hidden, so just show it
      return;
    }

    setTimeout(() => this.setState({show: true}), this.props.delay || 0);
  }

  render () {
    return this.state.show ? this.props.children : null;
  }
}

Lazy.propTypes = {
  delay: PropTypes.number,
};

export default Lazy;
