import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { CSSProperties, Fragment, PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { hotKeyRefs } from '../../../../common/hotkeys';
import { executeHotKey } from '../../../../common/hotkeys-listener';
import { fuzzyMatch } from '../../../../common/misc';
import { KeydownBinder } from '../../keydown-binder';
import { DropdownButton } from './dropdown-button';
import { DropdownDivider } from './dropdown-divider';
import { DropdownItem } from './dropdown-item';
const dropdownsContainer = document.querySelector('#dropdowns-container');

export interface DropdownProps {
  children: ReactNode;
  right?: boolean;
  outline?: boolean;
  wide?: boolean;
  onOpen?: Function;
  onHide?: Function;
  className?: string;
  style?: CSSProperties;
  beside?: boolean;
}

interface State {
  open: boolean;
  dropUp: boolean;
  filter: string;
  filterVisible: boolean;
  filterItems?: number[] | null;
  filterActiveIndex: number;
  forcedPosition?: {x: number; y: number} | null;
  uniquenessKey: number;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Dropdown extends PureComponent<DropdownProps, State> {
  private _node: HTMLDivElement | null = null;
  private _dropdownList: HTMLDivElement | null = null;
  private _filter: HTMLInputElement | null = null;

  state: State = {
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

  _setRef(n: HTMLDivElement) {
    this._node = n;
  }

  _handleCheckFilterSubmit(e) {
    if (e.key === 'Enter') {
      // Listen for the Enter key and "click" on the active list item
      const selector = `li[data-filter-index="${this.state.filterActiveIndex}"] button`;

      const button = this._dropdownList?.querySelector(selector);

      // @ts-expect-error -- TSCONVERSION
      button?.click();
    }
  }

  _handleChangeFilter(event: React.ChangeEvent<HTMLInputElement>) {
    const newFilter = event.target.value;

    // Nothing to do if the filter didn't change
    if (newFilter === this.state.filter) {
      return;
    }

    // Filter the list items that are filterable (have data-filter-index property)
    const filterItems: number[] = [];

    // @ts-expect-error -- TSCONVERSION convert to array or use querySelectorAll().forEach
    for (const listItem of this._dropdownList.querySelectorAll('li')) {
      if (!listItem.hasAttribute('data-filter-index')) {
        continue;
      }

      const match = fuzzyMatch(newFilter, listItem.textContent);

      if (!newFilter || match) {
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
        // @ts-expect-error -- TSCONVERSION convert to array or use querySelectorAll().forEach
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
        this.setState({
          filterActiveIndex: nextI,
        });
      } else {
        this.setState({
          filterActiveIndex: items[i + 1] || items[0],
        });
      }
    }

    this._filter?.focus();
  }

  _handleBodyKeyDown(e) {
    if (!this.state.open) {
      return;
    }

    // Catch all key presses (like global app hotkeys) if we're open
    e.stopPropagation();

    this._handleDropdownNavigation(e);

    executeHotKey(e, hotKeyRefs.CLOSE_DROPDOWN, () => {
      this.hide();
    });
  }

  _checkSizeAndPosition() {
    if (!this.state.open || !this._dropdownList) {
      return;
    }

    // Get dropdown menu
    const dropdownList = this._dropdownList;

    // Compute the size of all the menus
    // @ts-expect-error -- TSCONVERSION should exit if node is not defined
    let dropdownBtnRect = this._node.getBoundingClientRect();

    const bodyRect = document.body.getBoundingClientRect();
    const dropdownListRect = dropdownList.getBoundingClientRect();
    const { forcedPosition } = this.state;

    if (forcedPosition) {
      // @ts-expect-error -- TSCONVERSION missing properties
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
    this._dropdownList.style.minWidth = 'initial';
    this._dropdownList.style.maxWidth = 'initial';
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

  _addDropdownListRef(n: HTMLDivElement) {
    this._dropdownList = n;
  }

  _addFilterRef(n: HTMLInputElement) {
    this._filter = n;

    // Automatically focus the filter element when mounted so we can start typing
    if (this._filter) {
      this._filter.focus();
    }
  }

  _getFlattenedChildren(children) {
    let newChildren: ReactNode[] = [];
    // Ensure children is an array
    children = Array.isArray(children) ? children : [children];

    for (const child of children) {
      if (!child) {
        // Ignore null components
        continue;
      }

      if (child.type === Fragment) {
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

      button?.focus();
    }

    this.setState({
      open: false,
    });
    this.props.onHide?.();
  }

  show(filterVisible = false, forcedPosition: { x: number; y: number } | null = null) {
    const bodyHeight = document.body.getBoundingClientRect().height;

    // @ts-expect-error -- TSCONVERSION _node can be undefined
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
    this.props.onOpen?.();
  }

  toggle(filterVisible = false) {
    if (this.state.open) {
      this.hide();
    } else {
      this.show(filterVisible);
    }
  }

  render() {
    const { right, outline, wide, className, style, children } = this.props;
    const {
      dropUp,
      open,
      uniquenessKey,
      filterVisible,
      filterActiveIndex,
      filterItems,
      filter,
    } = this.state;
    const classes = classnames('dropdown', className, {
      'dropdown--wide': wide,
      'dropdown--open': open,
    });
    const menuClasses = classnames({
      // eslint-disable-next-line camelcase
      dropdown__menu: true,
      'theme--dropdown__menu': true,
      'dropdown__menu--open': open,
      'dropdown__menu--outlined': outline,
      'dropdown__menu--up': dropUp,
      'dropdown__menu--right': right,
    });
    const dropdownButtons: ReactNode[] = [];
    const dropdownItems: ReactNode[] = [];

    const allChildren = this._getFlattenedChildren(children);

    const visibleChildren = allChildren.filter((child, i) => {
      // @ts-expect-error -- TSCONVERSION this should cater for all types that ReactNode can be
      if (child.type.name !== DropdownItem.name) {
        return true;
      }

      // It's visible if its index is in the filterItems
      return !filterItems || filterItems.includes(i);
    });

    for (let i = 0; i < allChildren.length; i++) {
      const child = allChildren[i];

      // @ts-expect-error -- TSCONVERSION this should cater for all types that ReactNode can be
      if (child.type.name === DropdownButton.name) {
        dropdownButtons.push(child);
      // @ts-expect-error -- TSCONVERSION this should cater for all types that ReactNode can be
      } else if (child.type.name === DropdownItem.name) {
        const active = i === filterActiveIndex;
        const hide = !visibleChildren.includes(child);
        dropdownItems.push(
          <li
            key={i}
            data-filter-index={i}
            className={classnames({
              active,
              hide,
            })}
          >
            {child}
          </li>,
        );
      // @ts-expect-error -- TSCONVERSION this should cater for all types that ReactNode can be
      } else if (child.type.name === DropdownDivider.name) {
        const currentIndex = visibleChildren.indexOf(child);
        const nextChild = visibleChildren[currentIndex + 1];

        // Only show the divider if the next child is a DropdownItem
        // @ts-expect-error -- TSCONVERSION this should cater for all types that ReactNode can be
        if (nextChild && nextChild.type.name === DropdownItem.name) {
          dropdownItems.push(<li key={i}>{child}</li>);
        }
      }
    }

    let finalChildren: React.ReactNode = [];

    if (dropdownButtons.length !== 1) {
      console.error(`Dropdown needs exactly one DropdownButton! Got ${dropdownButtons.length}`, {
        allChildren,
      });
    } else {
      const noResults = filter && filterItems && filterItems.length === 0;
      finalChildren = [
        dropdownButtons[0],
        ReactDOM.createPortal(
          <div
            key="item"
            className={menuClasses}
            aria-hidden={!open}
          >
            <div className="dropdown__backdrop theme--transparent-overlay" />
            <div
              key={uniquenessKey}
              ref={this._addDropdownListRef}
              tabIndex={-1}
              className={classnames('dropdown__list', {
                'dropdown__list--filtering': filterVisible,
              })}
            >
              <div className="form-control dropdown__filter">
                <i className="fa fa-search" />
                <input
                  type="text"
                  onChange={this._handleChangeFilter}
                  ref={this._addFilterRef}
                  onKeyPress={this._handleCheckFilterSubmit}
                />
              </div>
              {noResults && <div className="text-center pad warning">No match :(</div>}
              <ul
                className={classnames({
                  hide: noResults,
                })}
              >
                {dropdownItems}
              </ul>
            </div>
          </div>,
          // @ts-expect-error -- TSCONVERSION
          dropdownsContainer,
        ),
      ];
    }

    return (
      <KeydownBinder stopMetaPropagation onKeydown={this._handleBodyKeyDown} disabled={!open}>
        <div
          style={style}
          className={classes}
          ref={this._setRef}
          onClick={this._handleClick}
          tabIndex={-1}
          onMouseDown={Dropdown._handleMouseDown}
        >
          {finalChildren}
        </div>
      </KeydownBinder>
    );
  }
}
