import React, {Component, PropTypes} from 'react'
import classnames from 'classnames'

class Dropdown extends Component {
  constructor () {
    super();
    this.state = {
      open: false
    };
  }

  componentDidMount () {
    // Capture clicks outside the component and close the dropdown
    // TODO: Remove this listener when component unmounts
    document.addEventListener('click', this._clickCallback.bind(this));
  }

  componentWillUnmount () {
    document.removeEventListener('click', this._clickCallback);
  }

  _clickCallback (e) {
    const container = this.refs.container;

    if (container && !container.contains(e.target)) {
      e.preventDefault();
      this.setState({open: false});
    }
  }

  _handleClick (e) {
    e.preventDefault();
    this.setState({open: !this.state.open});
  }

  render () {
    const className = classnames(
      'dropdown',
      this.props.className,
      {'dropdown--open': this.state.open},
      {'dropdown--right': this.props.right}
    );

    return (
      <div ref="container" className={className} onClick={this._handleClick.bind(this)}>
        {this.props.children}
      </div>
    )
  }
}

Dropdown.propTypes = {
  right: PropTypes.bool
};

export default Dropdown;
