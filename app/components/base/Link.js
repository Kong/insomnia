import React, {Component, PropTypes} from 'react';
import {shell} from 'electron';

class Link extends Component {
  render () {
    const {button, href, children, ...other} = this.props;
    return button ? (
      <button onClick={() => shell.openExternal(href)} {...other}>
        {children}
      </button>
    ) :(
      <a href={href} onClick={e => {e.preventDefault(); shell.openExternal(href)}} {...other}>
        {children}
      </a>
    )
  }
}

Link.propTypes = {
  href: PropTypes.string.isRequired,

  // Optional
  button: PropTypes.bool
};

export default Link;
