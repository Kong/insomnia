import classnames from 'classnames';
import { any, equals } from 'ramda';
import React, {
  CSSProperties,
  forwardRef,
  Fragment,
  isValidElement,
  ReactNode,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactDOM from 'react-dom';

import { hotKeyRefs } from '../../../../common/hotkeys';
import { executeHotKey } from '../../../../common/hotkeys-listener';
import { fuzzyMatch } from '../../../../common/misc';
import { KeydownBinder } from '../../keydown-binder';
import { DropdownButton } from './dropdown-button';
import { DropdownDivider } from './dropdown-divider';
import { DropdownItem } from './dropdown-item';

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

export const dropdownsContainerId = 'dropdowns-container';

interface State {
  open: boolean;
  filter: string;
  filterVisible: boolean;
  filterItems?: number[] | null;
  filterActiveIndex: number;
  uniquenessKey: number;
}

const isComponent = (match: string) => (child: ReactNode) =>
  any(equals(match), [
    // @ts-expect-error this is required by our API for Dropdown
    child.type.name,
    // @ts-expect-error this is required by our API for Dropdown
    child.type.displayName,
  ]);

const isDropdownItem = isComponent(DropdownItem.name);
const isDropdownButton = isComponent(DropdownButton.name);
const isDropdownDivider = isComponent(DropdownDivider.name);

const _getFlattenedChildren = (children: ReactNode[] | ReactNode) => {
  let newChildren: ReactNode[] = [];
  // Ensure children is an array
  const flatChildren = Array.isArray(children) ? children : [children];

  for (const child of flatChildren) {
    if (!child) {
      // Ignore null components
      continue;
    }

    if (isValidElement(child) && child.type === Fragment) {
      newChildren = [
        ...newChildren,
        ..._getFlattenedChildren(child.props.children),
      ];
    } else if (Array.isArray(child)) {
      newChildren = [...newChildren, ..._getFlattenedChildren(child)];
    } else {
      newChildren.push(child);
    }
  }

  return newChildren;
};

export interface DropdownHandle {
  show: (
    filterVisible?: boolean,
  ) => void;
  hide: () => void;
  toggle: (filterVisible?: boolean) => void;
}

export const Dropdown = forwardRef<DropdownHandle, DropdownProps>(
  ({ right, outline, className, style, children, beside, onOpen, onHide, wide }, ref) => {
    const [
      {
        open,
        uniquenessKey,
        filterVisible,
        filterActiveIndex,
        filterItems,
        filter,
      },
      setState,
    ] = useState<State>({
      open: false,
      // Filter Stuff
      filter: '',
      filterVisible: false,
      filterItems: null,
      filterActiveIndex: 0,
      // Use this to force new menu every time dropdown opens
      uniquenessKey: 0,
    });
    const _node = useRef<HTMLDivElement>(null);
    const _dropdownList = useRef<HTMLDivElement>(null);
    const _filter = useRef<HTMLInputElement>(null);

    const _handleCheckFilterSubmit = useCallback((
      event: React.KeyboardEvent<HTMLInputElement>
    ) => {
      if (event.key === 'Enter') {
        // Listen for the Enter key and "click" on the active list item
        const selector = `li[data-filter-index="${filterActiveIndex}"] button`;

        const button = _dropdownList.current?.querySelector(selector);

        if (button instanceof HTMLButtonElement) {
          button.click();
        }
      }
    }, [filterActiveIndex]);

    const _handleChangeFilter = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const newFilter = event.target.value;

      // Nothing to do if the filter didn't change
      if (newFilter === filter) {
        return;
      }

      // Filter the list items that are filterable (have data-filter-index property)
      const filterItems: number[] = [];

      const filterableItems = _dropdownList.current?.querySelectorAll('li');

      if (filterableItems instanceof NodeList) {
        for (const listItem of filterableItems) {
          if (!listItem.hasAttribute('data-filter-index')) {
            continue;
          }

          const match = fuzzyMatch(newFilter, listItem.textContent || '');

          if (!newFilter || match) {
            const filterIndex = listItem.getAttribute('data-filter-index');

            if (filterIndex) {
              filterItems.push(parseInt(filterIndex, 10));
            }
          }
        }

        setState({
          open,
          uniquenessKey,
          filter: newFilter,
          filterItems: newFilter ? filterItems : null,
          filterActiveIndex: filterItems[0] || -1,
          filterVisible: filterVisible ? true : newFilter.length > 0,
        });
      }
    }, [filter, filterVisible, open, uniquenessKey]);

    const _handleDropdownNavigation = useCallback((event: KeyboardEvent) => {
      const { key, shiftKey } = event;
      // Handle tab and arrows to move up and down dropdown entries
      if (['Tab', 'ArrowDown', 'ArrowUp'].includes(key)) {
        event.preventDefault();
        const items = filterItems || [];

        if (!filterItems) {
          const filterableItems = _dropdownList.current?.querySelectorAll('li');

          if (filterableItems instanceof NodeList) {
            for (const li of filterableItems) {
              if (li.hasAttribute('data-filter-index')) {
                const filterIndex = li.getAttribute('data-filter-index');
                if (filterIndex) {
                  items.push(parseInt(filterIndex, 10));
                }
              }
            }
          }
        }

        const i = items.indexOf(filterActiveIndex);

        if (key === 'ArrowUp' || (key === 'Tab' && shiftKey)) {
          const nextI = i > 0 ? items[i - 1] : items[items.length - 1];
          setState({
            open,
            uniquenessKey,
            filter,
            filterItems,
            filterVisible,
            filterActiveIndex: nextI,
          });
        } else {
          setState({
            open,
            uniquenessKey,
            filter,
            filterItems,
            filterVisible,
            filterActiveIndex: items[i + 1] || items[0],
          });
        }
      }

      _filter.current?.focus();
    }, [filter, filterActiveIndex, filterItems, filterVisible, open, uniquenessKey]);

    const _handleBodyKeyDown = (event: KeyboardEvent) => {
      if (!open) {
        return;
      }

      // Catch all key presses (like global app hotkeys) if we're open
      event.stopPropagation();

      _handleDropdownNavigation(event);

      executeHotKey(event, hotKeyRefs.CLOSE_DROPDOWN, () => {
        hide();
      });
    };

    const isNearBottomOfScreen = () => {
      if (!_node.current) {
        return false;
      }

      const bodyHeight = document.body.getBoundingClientRect().height;
      const dropdownTop = _node.current.getBoundingClientRect().top;

      return dropdownTop > bodyHeight - 200;
    };

    // Recalculate the position of the dropdown
    useLayoutEffect(() => {
      if (!open || !_dropdownList.current) {
        return;
      }

      // Compute the size of all the menus
      const dropdownBtnRect = _node.current?.getBoundingClientRect();
      if (!dropdownBtnRect) {
        return;
      }
      const bodyRect = document.body.getBoundingClientRect();
      const dropdownListRect = _dropdownList.current.getBoundingClientRect();

      // Reset all the things so we can start fresh
      _dropdownList.current.style.left = 'initial';
      _dropdownList.current.style.right = 'initial';
      _dropdownList.current.style.top = 'initial';
      _dropdownList.current.style.bottom = 'initial';
      _dropdownList.current.style.minWidth = 'initial';
      _dropdownList.current.style.maxWidth = 'initial';

      const screenMargin = 6;
      if (right || wide) {
        // Prevent dropdown from squishing against left side of screen
        const rightMargin = Math.max(
          dropdownListRect.width + screenMargin,
          dropdownBtnRect.right
        );

        const offset = beside ? dropdownBtnRect.width - 40 : 0;
        _dropdownList.current.style.right = `${
          bodyRect.width - rightMargin + offset
        }px`;
        _dropdownList.current.style.maxWidth = `${Math.min(
          dropdownListRect.width,
          rightMargin + offset
        )}px`;
      }

      if (!right || wide) {
        const offset = beside ? dropdownBtnRect.width - 40 : 0;
        // Prevent dropdown from squishing against right side of screen
        const leftMargin = Math.min(
          bodyRect.width - dropdownListRect.width - screenMargin,
          dropdownBtnRect.left
        );
        _dropdownList.current.style.left = `${leftMargin + offset}px`;
        _dropdownList.current.style.maxWidth = `${Math.min(
          dropdownListRect.width,
          bodyRect.width - leftMargin - offset
        )}px`;
      }

      if (isNearBottomOfScreen()) {
        _dropdownList.current.style.bottom = `${
          bodyRect.height - dropdownBtnRect.top
        }px`;
        _dropdownList.current.style.maxHeight = `${
          dropdownBtnRect.top - screenMargin
        }px`;
      } else {
        _dropdownList.current.style.top = `${dropdownBtnRect.bottom}px`;
        _dropdownList.current.style.maxHeight = `${
          bodyRect.height - dropdownBtnRect.bottom - screenMargin
        }px`;
      }
    }, [beside, open, right, wide]);

    const _handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    };

    const _handleMouseDown = (event: React.MouseEvent) => {
      // Intercept mouse down so that clicks don't trigger things like drag and drop.
      event.preventDefault();
    };

    const hide = useCallback(() => {
      // Focus the dropdown button after hiding
      if (_node.current) {
        const button = _node.current.querySelector('button');

        button?.focus();
      }

      setState({
        uniquenessKey,
        filterVisible,
        filterActiveIndex,
        filterItems,
        filter,
        open: false,
      });

      onHide?.();
    }, [
      filter,
      filterActiveIndex,
      filterItems,
      filterVisible,
      onHide,
      uniquenessKey,
    ]);

    const show = useCallback(
      (
        filterVisible = false,
      ) => {
        setState({
          open: true,
          filterVisible,
          filter: '',
          filterItems: null,
          filterActiveIndex: -1,
          uniquenessKey: uniquenessKey + 1,
        });

        onOpen?.();
      },
      [onOpen, uniquenessKey]
    );

    const toggle = useCallback(
      (filterVisible = false) => {
        if (open) {
          hide();
        } else {
          show(filterVisible);
        }
      },
      [hide, open, show]
    );

    useImperativeHandle(
      ref,
      () => ({
        show,
        hide,
        toggle,
      }),
      [hide, show, toggle]
    );

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
      'dropdown__menu--up': isNearBottomOfScreen(),
      'dropdown__menu--right': right,
    });

    const dropdownChildren = useMemo(() => {
      const dropdownButtons: ReactNode[] = [];
      const dropdownItems: ReactNode[] = [];

      const allChildren = _getFlattenedChildren(children);

      const visibleChildren = allChildren.filter((child, i) => {
        if (!isDropdownItem(child)) {
          return true;
        }

        // It's visible if its index is in the filterItems
        return !filterItems || filterItems.includes(i);
      });

      for (let i = 0; i < allChildren.length; i++) {
        const child = allChildren[i];

        if (isDropdownButton(child)) {
          dropdownButtons.push(child);
        } else if (isDropdownItem(child)) {
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
            </li>
          );
        } else if (isDropdownDivider(child)) {
          const currentIndex = visibleChildren.indexOf(child);
          const nextChild = visibleChildren[currentIndex + 1];

          // Only show the divider if the next child is a DropdownItem
          if (nextChild && isDropdownItem(nextChild)) {
            dropdownItems.push(<li key={i}>{child}</li>);
          }
        }
      }

      let finalChildren: React.ReactNode = [];

      if (dropdownButtons.length !== 1) {
        console.error(
          `Dropdown needs exactly one DropdownButton! Got ${dropdownButtons.length}`,
          {
            allChildren,
          }
        );
      } else {
        const noResults = filter && filterItems && filterItems.length === 0;
        const dropdownsContainer = document.getElementById(dropdownsContainerId);

        if (!dropdownsContainer) {
          console.error('Dropdown: a #dropdowns-container element is required for a dropdown to render properly');

          return null;
        }

        finalChildren = [
          dropdownButtons[0],
          ReactDOM.createPortal(
            <div key="item" className={menuClasses} aria-hidden={!open}>
              <div className="dropdown__backdrop theme--transparent-overlay" />
              <div
                key={uniquenessKey}
                ref={_dropdownList}
                tabIndex={-1}
                className={classnames('dropdown__list', {
                  'dropdown__list--filtering': filterVisible,
                })}
              >
                <div className="form-control dropdown__filter">
                  <i className="fa fa-search" />
                  <input
                    type="text"
                    autoFocus={open}
                    onChange={_handleChangeFilter}
                    ref={_filter}
                    onKeyPress={_handleCheckFilterSubmit}
                  />
                </div>
                {noResults && (
                  <div className="text-center pad warning">{'No match :('}</div>
                )}
                <ul
                  className={classnames({
                    hide: noResults,
                  })}
                >
                  {dropdownItems}
                </ul>
              </div>
            </div>,
            dropdownsContainer
          ),
        ];
      }

      return finalChildren;
    }, [_handleChangeFilter, _handleCheckFilterSubmit, children, filter, filterActiveIndex, filterItems, filterVisible, menuClasses, open, uniquenessKey]);

    return (
      <KeydownBinder
        stopMetaPropagation
        onKeydown={_handleBodyKeyDown}
        disabled={!open}
      >
        <div
          style={style}
          className={classes}
          ref={_node}
          onClick={_handleClick}
          tabIndex={-1}
          onMouseDown={_handleMouseDown}
        >
          {dropdownChildren}
        </div>
      </KeydownBinder>
    );
  }
);

Dropdown.displayName = 'Dropdown';
