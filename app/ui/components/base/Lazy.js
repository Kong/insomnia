import React, {PureComponent, PropTypes} from 'react';

class Lazy extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {show: false};
  }

  componentDidMount () {
    const delay = this.props.delay || 0;
    setTimeout(() => this.setState({show: true}), delay);
  }

  render () {
    return this.state.show ? this.props.children : null;
  }
}

Lazy.propTypes = {
  delay: PropTypes.number,
};

export default Lazy;
