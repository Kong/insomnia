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

  _checkSizeAndPosition () {
    if (!this.state.open) {
      return;
    }

    // Make the dropdown scroll if it drops off screen.
    const dropdownRect = this._node.getBoundingClientRect();
    const bodyRect = document.body.getBoundingClientRect();

    // Should it drop up?
    const bodyHeight = bodyRect.height;
    const dropdownTop = dropdownRect.top;
    const dropUp = dropdownTop > bodyHeight - 200;

    // Reset all the things so we can start fresh
    this._dropdownList.style.left = 'initial';
    this._dropdownList.style.right = 'initial';
    this._dropdownList.style.top = 'initial';
    this._dropdownList.style.bottom = 'initial';

    const {right, wide} = this.props;
    if (right || wide) {
      const {right} = dropdownRect;
      this._dropdownList.style.right = `${bodyRect.width - right}px`;
      this._dropdownList.style.maxWidth = `${right}px`;
      this._dropdownList.style.minWidth = `${Math.min(right, 200)}px`;
    }

    if (!right || wide) {
      const {left} = dropdownRect;
      this._dropdownList.style.left = `${left}px`;
      this._dropdownList.style.maxWidth = `${bodyRect.width - left - 5}px`;
      this._dropdownList.style.minWidth = `${Math.min(bodyRect.width - left, 200)}px`;
    }

    if (dropUp) {
      const {top} = dropdownRect;
      this._dropdownList.style.bottom = `${bodyRect.height - top}px`;
      this._dropdownList.style.maxHeight = `${top - 5}px`;
    } else {
      const {bottom} = dropdownRect;
      this._dropdownList.style.top = `${bottom}px`;
      this._dropdownList.style.maxHeight = `${bodyRect.height - bottom - 5}px`;
    }
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

    // Move the element to the body so we can position absolutely
    if (n) {
      let container = document.querySelector('#dropdowns-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'dropdowns-container';
        document.body.appendChild(container);
      }

      container.appendChild(ReactDOM.findDOMNode(n));
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

    return newChildren;
  }

  componentDidUpdate () {
    this._checkSizeAndPosition();
  }

  componentDidMount () {
    document.body.addEventListener('keydown', this._handleKeyDown);
    window.addEventListener('resize', this._checkSizeAndPosition);
  }

  componentWillUnmount () {
    document.body.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('resize', this._checkSizeAndPosition);
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
    const {right, outline, wide, className, style, children, rightOffset} = this.props;
    const {dropUp, open} = this.state;

    const classes = classnames('dropdown', className, {
      'dropdown--wide': wide,
      'dropdown--open': open
    });

    const menuClasses = classnames({
      'dropdown__menu': true,
      'theme--dropdown__menu': true,
      'dropdown__menu--open': open,
      'dropdown__menu--outlined': outline,
      'dropdown__menu--up': dropUp,
      'dropdown__menu--right': right
    });

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
      const styles = {};
      if (typeof rightOffset === 'number') {
        styles.marginRight = `-${rightOffset}px`;
      }

      finalChildren = [
        dropdownButtons[0],
        <ul key="items" className={menuClasses} style={styles} ref={this._addDropdownListRef}>
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
  style: PropTypes.string,
  rightOffset: PropTypes.number
};

export default Dropdown;
