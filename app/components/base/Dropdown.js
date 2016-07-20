import React, {Component, PropTypes} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';

import Mousetrap from '../../lib/mousetrap';

class Dropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
      dropUp: false
    };
  }

  _handleClick(e) {
    // e.preventDefault();

    this.toggle();
  }

  hide() {
    this.setState({open: false});
  }
  
  show() {
    Mousetrap.bind('esc', () => {
      this.hide();
    });

    const bodyHeight = document.body.getBoundingClientRect().height;
    const dropdownTop = ReactDOM.findDOMNode(this).getBoundingClientRect().top;
    const dropUp = dropdownTop > bodyHeight * 0.75;

    this.setState({open: true, dropUp});
  }
  
  toggle() {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  render() {
    const {right, className} = this.props;
    const {dropUp, open} = this.state;

    const classes = classnames(
      'dropdown',
      className,
      {'dropdown--open': open},
      {'dropdown--up': dropUp},
      {'dropdown--right': right}
    );

    return (
      <div
        className={classes}
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
