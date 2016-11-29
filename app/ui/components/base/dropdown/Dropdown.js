import React, {Component, PropTypes} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import DropdownButton from './DropdownButton';
import DropdownItem from './DropdownItem';
import DropdownDivider from './DropdownDivider';

class Dropdown extends Component {
  state = {
    open: false,
    dropUp: false,
    focused: false,
  };

  _handleKeyDown = e => {
    // Catch all key presses if we're open
    if (this.state.open) {
      e.stopPropagation();
    }

    // Pressed escape?
    if (this.state.open && e.keyCode === 27) {
      e.preventDefault();
      this.hide();
    }
  };

  _checkSize = () => {
    if (!this.state.open) {
      return;
    }

    // Make the dropdown scroll if it drops off screen.
    const rect = this._dropdownList.getBoundingClientRect();
    const maxHeight = document.body.clientHeight - rect.top - 10;
    this._dropdownList.style.maxHeight = `${maxHeight}px`;
  };

  _handleClick = () => {
    this.toggle();
  };

  _handleMouseDown = e => {
    // Intercept mouse down so that clicks don't trigger things like
    // drag and drop.
    e.preventDefault();
  };

  _addDropdownListRef = n => this._dropdownList = n;

  componentDidUpdate () {
    this._checkSize();
  }

  componentDidMount () {
    document.body.addEventListener('keydown', this._handleKeyDown);
    window.addEventListener('resize', this._checkSize);
  }

  componentWillUnmount () {
    document.body.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('resize', this._checkSize);
  }

  hide () {
    this.setState({open: false});
  }

  show () {
    const bodyHeight = document.body.getBoundingClientRect().height;
    const dropdownTop = ReactDOM.findDOMNode(this).getBoundingClientRect().top;
    const dropUp = dropdownTop > bodyHeight * 0.65;

    this.setState({open: true, dropUp});
  }

  toggle () {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  _getFlattenedChildren (children) {
    let newChildren = [];

    for (const child of children) {
      if (!child) {
        // Ignore null components
        continue;
      }

      if (Array.isArray(child)) {
        newChildren = [...newChildren, ...this._getFlattenedChildren(child)];
      } else {
        newChildren.push(child);
      }
    }

    return newChildren
  }

  render () {
    const {right, outline, wide, className, style} = this.props;
    const {dropUp, open} = this.state;

    const classes = classnames(
      'dropdown',
      className,
      {'dropdown--open': open},
      {'dropdown--wide': wide},
      {'dropdown--outlined': outline},
      {'dropdown--up': dropUp},
      {'dropdown--right': right}
    );

    const dropdownButtons = [];
    const dropdownItems = [];
    for (const child of this._getFlattenedChildren(this.props.children)) {
      if (child.type === DropdownButton) {
        dropdownButtons.push(child);
      } else if (child.type === DropdownItem) {
        dropdownItems.push(child);
      } else if (child.type === DropdownDivider) {
        dropdownItems.push(child);
      }
    }

    let children = [];
    if (dropdownButtons.length !== 1) {
      console.error(`Dropdown needs exactly one DropdownButton! Got ${dropdownButtons.length}`, this.props);
    } else if (dropdownItems.length === 0) {
      children = dropdownButtons;
    } else {
      children = [
        dropdownButtons[0],
        <ul key="items" ref={this._addDropdownListRef}>
          {dropdownItems}
        </ul>
      ]
    }

    return (
      <div style={style}
           className={classes}
           onClick={this._handleClick}
           onMouseDown={this._handleMouseDown}>
        {children}
        <div className="dropdown__backdrop"></div>
      </div>
    )
  }
}

Dropdown.propTypes = {
  right: PropTypes.bool,
  outline: PropTypes.bool,
  wide: PropTypes.bool
};

export default Dropdown;
