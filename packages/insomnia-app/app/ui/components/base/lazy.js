import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';

@autobind
class Lazy extends PureComponent {
  constructor(props) {
    super(props);
    this.state = { show: false };
  }

  show() {
    this.setState({ show: true });
  }

  componentWillMount() {
    if (this.props.delay < 0) {
      // Show right away if negative delay passed
      this.show();
    } else {
      setTimeout(this.show, this.props.delay || 50);
    }
  }

  render() {
    return this.state.show ? this.props.children : null;
  }
}

Lazy.propTypes = {
  delay: PropTypes.number,
  children: PropTypes.node
};

export default Lazy;
