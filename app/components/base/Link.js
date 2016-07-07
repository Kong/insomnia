import React, {Component, PropTypes} from 'react';
import {shell} from 'electron'

class Link extends Component {
  _handleClick (e) {
    e.preventDefault();
    shell.openExternal(this.props.href);
  }

  render () {
    const {href, children, ...other} = this.props;
    return (
      <a href={href} onClick={this._handleClick.bind(this)} {...other}>
        {children}
      </a>
    )
  }
}

Link.propTypes = {
  href: PropTypes.string.isRequired
};

export default Link;
