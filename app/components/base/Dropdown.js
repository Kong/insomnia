import React, {Component, PropTypes} from 'react'
import classnames from 'classnames'

import Mousetrap from '../../lib/mousetrap'

class Dropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false
    };
  }

  _handleClick(e) {
    e.preventDefault();

    this.toggle();
  }

  hide() {
    this.setState({open: false});
  }
  
  show() {
    Mousetrap.bind('esc', () => {
      this.hide();
    });
    
    this.setState({open: true});
  }
  
  toggle() {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  render() {
    const className = classnames(
      'dropdown',
      this.props.className,
      {'dropdown--open': this.state.open},
      {'dropdown--right': this.props.right}
    );

    return (
      <div
        className={className}
        onClick={this._handleClick.bind(this)}>

        {this.props.children}
        <div className="dropdown__backdrop"></div>
      </div>
    )
  }
}

Dropdown.propTypes = {
  right: PropTypes.bool
};

export default Dropdown;
