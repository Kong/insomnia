import classnames from 'classnames';
import { any, equals } from 'ramda';
import React, {
  CSSProperties,
  forwardRef,
  Fragment,
  isValidElement,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
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

interface State {
  open: boolean;
  dropUp: boolean;
  filter: string;
  filterVisible: boolean;
  filterItems?: number[] | null;
  filterActiveIndex: number;
  forcedPosition?: { x: number; y: number } | null;
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

export interface DropdownHandle {
  show: () => void;
  hide: () => void;
  toggle: () => void;
}

export const Dropdown = forwardRef<DropdownHandle, DropdownProps>(((props, ref) => {
  const { right, outline, wide, className, style, children, beside, onOpen } = props;
  const [
    {
      dropUp,
      open,
      uniquenessKey,
      filterVisible,
      filterActiveIndex,
      filterItems,
      filter,
      forcedPosition,
    },
    setState,
  ] = useState<State>({
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
  });

  const _node = useRef<HTMLDivElement>(null);
  const _dropdownList = useRef<HTMLDivElement>(null);
  const _filter = useRef<HTMLInputElement>(null);

  function _handleCheckFilterSubmit(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Listen for the Enter key and "click" on the active list item
      const selector = `li[data-filter-index="${filterActiveIndex}"] button`;

      const button = _dropdownList.current?.querySelector(selector);

      if (button instanceof HTMLButtonElement) {
        button.click();
      }
    }
  }

  function _handleChangeFilter(event: React.ChangeEvent<HTMLInputElement>) {
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
        dropUp,
        uniquenessKey,
        filter: newFilter,
        filterItems: newFilter ? filterItems : null,
        filterActiveIndex: filterItems[0] || -1,
        filterVisible: filterVisible ? true : newFilter.length > 0,
      });
    }
  }

  function _handleDropdownNavigation(event: KeyboardEvent) {
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
          dropUp,
          uniquenessKey,
          filter,
          filterItems,
          filterVisible,
          filterActiveIndex: nextI,
        });
      } else {
        setState({
          open,
          dropUp,
          uniquenessKey,
          filter,
          filterItems,
          filterVisible,
          filterActiveIndex: items[i + 1] || items[0],
        });
      }
    }

    _filter.current?.focus();
  }

  function   _handleBodyKeyDown(event: KeyboardEvent) {
    if (!open) {
      return;
    }

    // Catch all key presses (like global app hotkeys) if we're open
    event.stopPropagation();

    _handleDropdownNavigation(event);

    executeHotKey(event, hotKeyRefs.CLOSE_DROPDOWN, () => {
      hide();
    });
  }

  function _checkSizeAndPosition() {
    if (!open || !_dropdownList.current) {
      return;
    }

    // Compute the size of all the menus
    let dropdownBtnRect = _node.current?.getBoundingClientRect();

    const bodyRect = document.body.getBoundingClientRect();
    const dropdownListRect = _dropdownList.current.getBoundingClientRect();

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

    // @TODO FIX ME
    if (dropdownBtnRect instanceof DOMRect) {
      // Should it drop up?
      const bodyHeight = bodyRect.height;
      const dropdownTop = dropdownBtnRect.top || 0;
      const dropUp = dropdownTop > bodyHeight - 200;
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
        _dropdownList.current.style.right = `${bodyRect.width - rightMargin + offset}px`;
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

      if (dropUp) {
        _dropdownList.current.style.bottom = `${bodyRect.height - dropdownBtnRect.top}px`;
        _dropdownList.current.style.maxHeight = `${dropdownBtnRect.top - screenMargin}px`;
      } else {
        _dropdownList.current.style.top = `${dropdownBtnRect.bottom}px`;
        _dropdownList.current.style.maxHeight = `${bodyRect.height - dropdownBtnRect.bottom - screenMargin}px`;
      }
    }
  }

  // useEffect(() => {
  //   _checkSizeAndPosition();
  // });

  function _handleClick(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    toggle();
  }

  function _handleMouseDown(event: React.MouseEvent) {
    // Intercept mouse down so that clicks don't trigger things like drag and drop.
    event.preventDefault();
  }

  // TODO: children should not be 'any'.
  /** Check me out bro
    function flattenChildren(children: React.ReactNode): ReactChildArray {
      const childrenArray = React.Children.toArray(children);
      return childrenArray.reduce((flatChildren: ReactChildArray, child) => {
        if ((child as React.ReactElement<any>).type === React.Fragment) {
          return flatChildren.concat(
            flattenChildren((child as React.ReactElement<any>).props.children)
          );
        }
        flatChildren.push(child);
        return flatChildren;
      }, []);
    }
   */
  function _getFlattenedChildren(children: ReactNode[] | ReactNode) {
    let newChildren: ReactNode[] = [];
    // Ensure children is an array
    const flatChildren = Array.isArray(children) ? children : [children];

    for (const child of flatChildren) {
      if (!child) {
        // Ignore null components
        continue;
      }

      if (child.type === Fragment) {
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
  }

  const hide = useCallback(() => {
    // Focus the dropdown button after hiding
    if (_node.current) {
      const button = _node.current.querySelector('button');

      button?.focus();
    }

    setState({
      dropUp,
      uniquenessKey,
      filterVisible,
      filterActiveIndex,
      filterItems,
      filter,
      forcedPosition,
      open: false,
    });

    props.onHide?.();
  }, [dropUp, filter, filterActiveIndex, filterItems, filterVisible, forcedPosition, props, uniquenessKey]);

  const show = useCallback((
    filterVisible = false,
    forcedPosition: { x: number; y: number } | null = null
  ) => {
    const bodyHeight = document.body.getBoundingClientRect().height;
    const dropdownTop = _node.current?.getBoundingClientRect().top;

    setState({
      open: true,
      dropUp: dropdownTop ? dropdownTop > bodyHeight - 200 : dropUp,
      forcedPosition,
      filterVisible,
      filter: '',
      filterItems: null,
      filterActiveIndex: -1,
      uniquenessKey: uniquenessKey + 1,
    });

    onOpen?.();
  }, [dropUp, onOpen, uniquenessKey]);

  const toggle = useCallback((filterVisible = false) => {
    if (open) {
      hide();
    } else {
      show(filterVisible);
    }
  }, [hide, open, show]);

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
    const dropdownsContainer = document.querySelector('#dropdowns-container');
    if (dropdownsContainer instanceof HTMLElement) {
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
                  autoFocus
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
  }

  useImperativeHandle(ref, () => ({
    show,
    hide,
    toggle,
  }), [hide, show, toggle]);

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
        {finalChildren}
      </div>
    </KeydownBinder>
  );
}));

Dropdown.displayName = 'Dropdown';
