import React, {Component, PropTypes} from 'react'
import {HotKeys} from 'react-hotkeys'
import classnames from 'classnames'

class Dropdown extends Component {
  constructor (props) {
    super(props);
    this.state = {
      open: false
    };
  }

  _handleClick (e) {
    e.preventDefault();

    if (this.state.open) {
      // TODO: Is this the best thing to do here? Maybe we should focus the last thing
      document.getElementById('wrapper').focus();
    }

    this.setState({open: !this.state.open});
  }

  hide () {
    this.setState({open: false});
  }

  render () {
    const className = classnames(
      'dropdown',
      this.props.className,
      {'dropdown--open': this.state.open},
      {'dropdown--right': this.props.right}
    );

    return (
      <HotKeys
        handlers={{escape: () => this.hide()}}
        className={className}
        onClick={this._handleClick.bind(this)}>

        {this.props.children}
        <div className="dropdown__backdrop"></div>
      </HotKeys>
    )
  }
}

Dropdown.propTypes = {
  right: PropTypes.bool
};

export default Dropdown;
