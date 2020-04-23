import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';
import fuzzySort from 'fuzzysort';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import DropdownItem from './dropdown-item';
import DropdownDivider from './dropdown-divider';
import styled, { css } from 'styled-components';
import SvgIcon from '../svg-icon';

const StyledDropdown = styled.div`
  position: relative;
  display: inline-block;
  box-sizing: border-box;
  text-align: left;

  &:focus {
    outline: none;
  }
`;

const StyledNoResults = styled.div`
  text-align: center;
  padding: var(--padding-md);
  color: var(--color-warning);
`;

const StyledBackdrop = styled.div`
  position: fixed;
  z-index: 9999;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  content: ' ';
`;

const StyledFilter = styled.div`
  border: 1px solid var(--hl-md);
  margin: var(--padding-xs);
  width: auto;
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-left: var(--padding-sm);
  color: var(--hl);

  // Can't "display: none" this because we need to be able to type
  // in it. So, we'll just store it off screen
  ${({ filtering }) =>
    filtering
      ? css`
          position: static;
          left: auto;
        `
      : css`
          position: absolute;
          left: -9999999px;
        `}

  input {
    margin: 0;
    padding: var(--padding-xs) var(--padding-sm);
    color: var(--color-font);
    outline: 0;
    border: 0;
  }
`;

const StyledMenu = styled.div`
  z-index: 99999;
  position: fixed;
  top: 0;
  left: 0;
  border: 1px solid var(--hl-sm);
  box-shadow: 0 0 1rem 0 rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  background: var(--color-bg);
  max-height: 100px;

  // Separate it from it's surroundings a bit
  margin: var(--padding-xxs) 3px;

  padding-top: var(--radius-md);
  padding-bottom: var(--radius-md);

  border-radius: var(--radius-md);
  overflow: auto;

  &:focus {
    outline: 0;
  }

  li {
    button:disabled {
      opacity: 0.5;
    }
  }

  li button:hover:not(:disabled),
  li.active button:not(:disabled) {
    background: var(--hl-xs);
  }

  li.active button:not(:disabled) {
    background: var(--hl-sm);
  }
`;

@autobind
class Dropdown extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      open: false,
      dropUp: false,

      // Filter Stuff
      filter: '',
      filterVisible: false,
      filterItems: null,
      filterActiveIndex: 0,

      // Position
      forcedPosition: null,

      // Use this to force new menu every time dropdown opens
      uniquenessKey: 0,
    };

    // Save body overflow so we can revert it when needed
    this.defaultBodyOverflow = document.body.style.overflow;

    this.dropdownsContainer = document.querySelector('#dropdowns-container');
    if (!this.dropdownsContainer) {
      this.dropdownsContainer = document.createElement('div');
      this.dropdownsContainer.id = 'dropdowns-container';
      this.dropdownsContainer.style = [
        // Position off-screen so we don't see it
        'position: fixed',
        'right: -90000px',
        'left: -90000px',

        // Make same size as viewport so we can use it to calculate the
        // position of the dropdown accurately.
        'width: 100vw',
        'height: 100vh',
      ].join('; ');
      document.body.appendChild(this.dropdownsContainer);
    }
  }

  _setRef(n) {
    this._node = n;
  }

  _handleCheckFilterSubmit(e) {
    if (e.key === 'Enter') {
      // Listen for the Enter key and "click" on the active list item
      const selector = `li[data-filter-index="${this.state.filterActiveIndex}"] button`;
      const button = this._dropdownList.querySelector(selector);
      button && button.click();
    }
  }

  _handleChangeFilter(e) {
    const newFilter = e.target.value;

    // Nothing to do if the filter didn't change
    if (newFilter === this.state.filter) {
      return;
    }

    // Filter the list items that are filterable (have data-filter-index property)
    const filterItems = [];
    for (const listItem of this._dropdownList.querySelectorAll('li')) {
      if (!listItem.hasAttribute('data-filter-index')) {
        continue;
      }

      const hasMatch = !!fuzzySort.single(newFilter, listItem.textContent);

      if (!newFilter || hasMatch) {
        const filterIndex = listItem.getAttribute('data-filter-index');
        filterItems.push(parseInt(filterIndex, 10));
      }
    }

    this.setState({
      filter: newFilter,
      filterItems: newFilter ? filterItems : null,
      filterActiveIndex: filterItems[0] || -1,
      filterVisible: this.state.filterVisible ? true : newFilter.length > 0,
    });
  }

  _handleDropdownNavigation(e) {
    const { key, shiftKey } = e;

    // Handle tab and arrows to move up and down dropdown entries
    const { filterItems, filterActiveIndex } = this.state;
    if (['Tab', 'ArrowDown', 'ArrowUp'].includes(key)) {
      e.preventDefault();
      const items = filterItems || [];
      if (!filterItems) {
        for (const li of this._dropdownList.querySelectorAll('li')) {
          if (li.hasAttribute('data-filter-index')) {
            const filterIndex = li.getAttribute('data-filter-index');
            items.push(parseInt(filterIndex, 10));
          }
        }
      }

      const i = items.indexOf(filterActiveIndex);
      if (key === 'ArrowUp' || (key === 'Tab' && shiftKey)) {
        const nextI = i > 0 ? items[i - 1] : items[items.length - 1];
        this.setState({ filterActiveIndex: nextI });
      } else {
        this.setState({ filterActiveIndex: items[i + 1] || items[0] });
      }
    }

    this._filter.focus();
  }

  _handleKeyDown(e) {
    if (!this.state.open) {
      return;
    }

    // Catch all key presses (like global app hotkeys) if we're open
    e.stopPropagation();

    this._handleDropdownNavigation(e);

    if (e.key === 'Escape') {
      this.hide();
    }
  }

  _checkSizeAndPosition() {
    if (!this.state.open || !this._dropdownList) {
      return;
    }

    // Get dropdown menu
    const dropdownList = this._dropdownList;

    // Compute the size of all the menus
    let dropdownBtnRect = this._node.getBoundingClientRect();
    const bodyRect = this.dropdownsContainer.getBoundingClientRect();
    const dropdownListRect = dropdownList.getBoundingClientRect();

    const { forcedPosition } = this.state;
    if (forcedPosition) {
      dropdownBtnRect = {
        left: forcedPosition.x,
        right: bodyRect.width - forcedPosition.x,
        top: forcedPosition.y,
        bottom: bodyRect.height - forcedPosition.y,
        width: 100,
        height: 10,
      };
    }

    // Should it drop up?
    const bodyHeight = bodyRect.height;
    const dropdownTop = dropdownBtnRect.top;
    const dropUp = dropdownTop > bodyHeight - 200;

    // Reset all the things so we can start fresh
    this._dropdownList.style.left = 'initial';
    this._dropdownList.style.right = 'initial';
    this._dropdownList.style.top = 'initial';
    this._dropdownList.style.bottom = 'initial';
    this._dropdownList.style.minWidth = this._cachedMinWidth || 'initial';
    this._dropdownList.style.maxWidth = 'initial';

    // Cache the width so we can use it later. This is because the dropdown width
    // could shrink once we start filtering items out.
    if (!this._cachedMinWidth) {
      this._cachedMinWidth = dropdownListRect.width + 'px';
    }

    const screenMargin = 6;

    const { right, wide } = this.props;
    if (right || wide) {
      const { right: originalRight } = dropdownBtnRect;

      // Prevent dropdown from squishing against left side of screen
      const right = Math.max(dropdownListRect.width + screenMargin, originalRight);

      const { beside } = this.props;
      const offset = beside ? dropdownBtnRect.width - 40 : 0;
      this._dropdownList.style.right = `${bodyRect.width - right + offset}px`;
      this._dropdownList.style.maxWidth = `${Math.min(dropdownListRect.width, right + offset)}px`;
    }

    if (!right || wide) {
      const { left: originalLeft } = dropdownBtnRect;

      const { beside } = this.props;
      const offset = beside ? dropdownBtnRect.width - 40 : 0;

      // Prevent dropdown from squishing against right side of screen
      const left = Math.min(bodyRect.width - dropdownListRect.width - screenMargin, originalLeft);

      this._dropdownList.style.left = `${left + offset}px`;
      this._dropdownList.style.maxWidth = `${Math.min(
        dropdownListRect.width,
        bodyRect.width - left - offset,
      )}px`;
    }

    if (dropUp) {
      const { top } = dropdownBtnRect;
      this._dropdownList.style.bottom = `${bodyRect.height - top}px`;
      this._dropdownList.style.maxHeight = `${top - screenMargin}px`;
    } else {
      const { bottom } = dropdownBtnRect;
      this._dropdownList.style.top = `${bottom}px`;
      this._dropdownList.style.maxHeight = `${bodyRect.height - bottom - screenMargin}px`;
    }
  }

  _handleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    this.toggle();
  }

  static _handleMouseDown(e) {
    // Intercept mouse down so that clicks don't trigger things like drag and drop.
    e.preventDefault();
  }

  _addDropdownListRef(n) {
    this._dropdownList = n;
  }

  _addFilterRef(n) {
    this._filter = n;

    // Automatically focus the filter element when mounted so we can start typing
    if (this._filter) {
      this._filter.focus();
    }
  }

  _addDropdownMenuRef(n) {
    this._dropdownMenu = n;
  }

  _getFlattenedChildren(children) {
    let newChildren = [];
    for (const child of React.Children.toArray(children)) {
      if (!child) {
        // Ignore null components
        continue;
      }

      if (child.type === React.Fragment) {
        newChildren = [...newChildren, ...this._getFlattenedChildren(child.props.children)];
      } else if (Array.isArray(child)) {
        newChildren = [...newChildren, ...this._getFlattenedChildren(child)];
      } else {
        newChildren.push(child);
      }
    }

    return newChildren;
  }

  componentDidUpdate() {
    this._checkSizeAndPosition();
  }

  hide() {
    // Focus the dropdown button after hiding
    if (this._node) {
      const button = this._node.querySelector('button');
      button && button.focus();
    }

    this.setState({ open: false });
    this.props.onHide && this.props.onHide();
  }

  show(filterVisible = false, forcedPosition = null) {
    const bodyHeight = document.body.getBoundingClientRect().height;
    const dropdownTop = this._node.getBoundingClientRect().top;
    const dropUp = dropdownTop > bodyHeight - 200;

    this.setState({
      open: true,
      dropUp,
      forcedPosition,
      filterVisible,
      filter: '',
      filterItems: null,
      filterActiveIndex: -1,
      uniquenessKey: this.state.uniquenessKey + 1,
    });

    this.props.onOpen && this.props.onOpen();
  }

  toggle(filterVisible = false) {
    if (this.state.open) {
      this.hide();
      document.body.style.overflow = this.defaultBodyOverflow;
    } else {
      this.show(filterVisible);

      // Prevent body from scrolling when dropdown is open
      document.body.style.overflow = 'hidden';
    }
  }

  render() {
    const { className, style, children, renderButton } = this.props;

    const {
      open,
      uniquenessKey,
      filterVisible,
      filterActiveIndex,
      filterItems,
      filter,
    } = this.state;

    const menuClasses = classnames({
      'theme--dropdown__menu': true,
    });

    const allChildren = this._getFlattenedChildren(children);

    const visibleChildren = allChildren.filter((child, i) => {
      if (child.type.name !== DropdownItem.name) {
        return true;
      }

      // It's visible if its index is in the filterItems
      return !filterItems || filterItems.includes(i);
    });

    const dropdownItems = [];

    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i];
      if (child.type.name === DropdownItem.name) {
        const active = i === filterActiveIndex;
        if (visibleChildren.includes(child)) {
          dropdownItems.push(
            <li key={i} data-filter-index={i} className={classnames({ active })}>
              {child}
            </li>,
          );
        }
      } else if (child.type.name === DropdownDivider.name) {
        const currentIndex = visibleChildren.indexOf(child);
        const nextChild = visibleChildren[currentIndex + 1];

        // Only show the divider if the next child is a DropdownItem
        if (nextChild && nextChild.type.name === DropdownItem.name) {
          dropdownItems.push(<li key={i}>{child}</li>);
        }
      }
    }

    const noResults = filter && filterItems && filterItems.length === 0;
    return (
      <StyledDropdown
        style={style}
        className={className}
        ref={this._setRef}
        onClick={this._handleClick}
        onKeyDown={this._handleKeyDown}
        tabIndex="-1"
        onMouseDown={Dropdown._handleMouseDown}>
        <React.Fragment key="button">{renderButton({ open })}</React.Fragment>
        {ReactDOM.createPortal(
          <div
            key="item"
            className={menuClasses}
            ref={this._addDropdownMenuRef}
            aria-hidden={!open}>
            {open && <StyledBackdrop className="theme--transparent-overlay" />}
            {open && (
              <StyledMenu key={uniquenessKey} ref={this._addDropdownListRef} tabIndex="-1">
                <StyledFilter filtering={filterVisible}>
                  <SvgIcon icon="search" />
                  <input
                    type="text"
                    onInput={this._handleChangeFilter}
                    ref={this._addFilterRef}
                    onKeyPress={this._handleCheckFilterSubmit}
                  />
                </StyledFilter>
                {noResults && <StyledNoResults>No match</StyledNoResults>}
                <ul className={classnames({ hide: noResults })}>{dropdownItems}</ul>
              </StyledMenu>
            )}
          </div>,
          this.dropdownsContainer,
        )}
      </StyledDropdown>
    );
  }
}

Dropdown.propTypes = {
  // Required
  children: PropTypes.node.isRequired,
  renderButton: PropTypes.func.isRequired,

  // Optional
  right: PropTypes.bool,
  outline: PropTypes.bool,
  wide: PropTypes.bool,
  onOpen: PropTypes.func,
  onHide: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.string,
  beside: PropTypes.bool,
};

export default Dropdown;
