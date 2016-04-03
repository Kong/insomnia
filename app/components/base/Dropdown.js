import React, {Component, PropTypes} from 'react';

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
    document.addEventListener('click', this._clickEvenCallback.bind(this));
  }

  componentWillUnmount () {
    document.removeEventListener('click', this._clickEvenCallback);
  }

  _clickEvenCallback (e) {
    if (this.refs.container && !this.refs.container.contains(e.target)) {
      e.preventDefault();
      this.setState({open: false});
    }
  }

  _handleClick (e) {
    e.preventDefault();
    this.setState({open: !this.state.open});
  }

  render () {
    const classes = ['dropdown'];

    this.state.open && classes.push('dropdown--open');
    this.props.right && classes.push('dropdown--right');

    return (
      <div ref="container" className={classes.join(' ')} onClick={this._handleClick.bind(this)}>
        {this.props.children}
      </div>
    )
  }
}

Dropdown.propTypes = {
  right: PropTypes.bool
};

export default Dropdown;
