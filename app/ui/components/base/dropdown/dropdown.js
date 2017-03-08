import React, {PureComponent, PropTypes} from 'react';
import ReactDOM from 'react-dom';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import DropdownButton from './dropdown-button';
import DropdownItem from './dropdown-item';
import DropdownDivider from './dropdown-divider';

@autobind
class Dropdown extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      open: false,
      dropUp: false,
      focused: false
    };
  }

  _setRef (n) {
    this._node = n;
  }

  _handleKeyDown (e) {
    // Catch all key presses if we're open
    if (this.state.open) {
      e.stopPropagation();
    }

    // Pressed escape?
    if (this.state.open && e.keyCode === 27) {
      e.preventDefault();
      this.hide();
    }
  }

  _checkSize () {
    if (!this.state.open) {
      return;
    }

    // Make the dropdown scroll if it drops off screen.
    const rect = ReactDOM.findDOMNode(this._dropdownList).getBoundingClientRect();
    const maxHeight = document.body.clientHeight - rect.top - 10;
    this._dropdownList.style.maxHeight = `${maxHeight}px`;
  }

  _handleClick () {
    this.toggle();
  }

  _handleMouseDown (e) {
    // Intercept mouse down so that clicks don't trigger things like
    // drag and drop.
    e.preventDefault();
  }

  _addDropdownListRef (n) {
    this._dropdownList = n;
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

    return newChildren;
  }

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
    this.props.onHide && this.props.onHide();
  }

  show () {
    const bodyHeight = document.body.getBoundingClientRect().height;
    const dropdownTop = this._node.getBoundingClientRect().top;
    const dropUp = dropdownTop > bodyHeight - 200;

    this.setState({open: true, dropUp});
    this.props.onOpen && this.props.onOpen();
  }

  toggle () {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  render () {
    const {right, outline, wide, className, style, children} = this.props;
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

    const listedChildren = Array.isArray(children) ? children : [children];
    const allChildren = this._getFlattenedChildren(listedChildren);
    for (const child of allChildren) {
      if (child.type.name === DropdownButton.name) {
        dropdownButtons.push(child);
      } else if (child.type.name === DropdownItem.name) {
        dropdownItems.push(child);
      } else if (child.type.name === DropdownDivider.name) {
        dropdownItems.push(child);
      }
    }

    let finalChildren = [];
    if (dropdownButtons.length !== 1) {
      console.error(
        `Dropdown needs exactly one DropdownButton! Got ${dropdownButtons.length}`,
        {allChildren}
      );
    } else {
      finalChildren = [
        dropdownButtons[0],
        <ul key="items" className="dropdown__menu" ref={this._addDropdownListRef}>
          {dropdownItems}
        </ul>
      ];
    }

    return (
      <div style={style}
           className={classes}
           ref={this._setRef}
           onClick={this._handleClick}
           onMouseDown={this._handleMouseDown}>
        {finalChildren}
        <div className="dropdown__backdrop"></div>
      </div>
    );
  }
}

Dropdown.propTypes = {
  // Required
  children: PropTypes.node.isRequired,

  // Optional
  right: PropTypes.bool,
  outline: PropTypes.bool,
  wide: PropTypes.bool,
  onOpen: PropTypes.func,
  onHide: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.string
};

export default Dropdown;
