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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactDOM from 'react-dom';

import { fuzzyMatch } from '../../../../common/misc';
import { createKeybindingsHandler } from '../../keydown-binder';
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

// This walks the children tree and returns the dropdown specific components.
// It allows us to use arrays, fragments etc.
const _getFlattenedChildren = (children: ReactNode[] | ReactNode) => {
  let newChildren: ReactNode[] = [];
  // Ensure children is an array
  const flatChildren: ReactNode[] = Array.isArray(children) ? children : [children];

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
  show: (filterVisible?: boolean) => void;
  hide: () => void;
  toggle: (filterVisible?: boolean) => void;
}

export const Dropdown = forwardRef<DropdownHandle, DropdownProps>(
  (
    {
      right,
      outline,
      className,
      style,
      children,
      beside,
      onOpen,
      onHide,
      wide,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    // @TODO: This is a hack to force new menu every time dropdown opens
    const [uniquenessKey, setUniquenessKey] = useState(0);
    const [filter, setFilter] = useState('');
    const [filterVisible, setFilterVisible] = useState(false);
    const [filterItems, setFilterItems] = useState<number[] | null>(null);
    const [filterActiveIndex, setFilterActiveIndex] = useState(0);

    const dropdownContainerRef = useRef<HTMLDivElement>(null);
    const dropdownListRef = useRef<HTMLDivElement>(null);
    const filterInputRef = useRef<HTMLInputElement>(null);

    const _handleCheckFilterSubmit = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          // Listen for the Enter key and "click" on the active list item
          const selector = `li[data-filter-index="${filterActiveIndex}"] button`;

          const button = dropdownListRef.current?.querySelector(selector);

          if (button instanceof HTMLButtonElement) {
            button.click();
          }
        }
      },
      [filterActiveIndex]
    );

    const _handleChangeFilter = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newFilter = event.target.value;

        // Nothing to do if the filter didn't change
        if (newFilter === filter) {
          return;
        }

        // Filter the list items that are filterable (have data-filter-index property)
        const filterItems: number[] = [];

        const filterableItems = dropdownListRef.current?.querySelectorAll('li');

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

          setFilter(newFilter);
          setFilterItems(newFilter ? filterItems : null);
          setFilterActiveIndex(filterItems[0] || -1);
          setFilterVisible(filterVisible || newFilter.length > 0);
        }
      },
      [filter, filterVisible]
    );

    const handleKeydown = createKeybindingsHandler({
      'Escape': () => {
        if (open) {
          hide();
        }
      },
      'Tab': () => {
        const items = filterItems || [];

        if (!filterItems) {
          const filterableItems =
            dropdownListRef.current?.querySelectorAll('li');

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
        setFilterActiveIndex(items[i + 1] || items[0]);

        filterInputRef.current?.focus();
      },
      'Shift+Tab': () => {
        const items = filterItems || [];

        if (!filterItems) {
          const filterableItems =
            dropdownListRef.current?.querySelectorAll('li');

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
        const nextI = i > 0 ? items[i - 1] : items[items.length - 1];
        setFilterActiveIndex(nextI);

        filterInputRef.current?.focus();
      },
      ArrowDown: event => {
        event.preventDefault();
        const items = filterItems || [];

        if (!filterItems) {
          const filterableItems =
            dropdownListRef.current?.querySelectorAll('li');

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

        setFilterActiveIndex(items[i + 1] || items[0]);

        filterInputRef.current?.focus();
      },
      ArrowUp: event => {
        event.preventDefault();
        const items = filterItems || [];

        if (!filterItems) {
          const filterableItems =
            dropdownListRef.current?.querySelectorAll('li');

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

        const nextI = i > 0 ? items[i - 1] : items[items.length - 1];
        setFilterActiveIndex(nextI);

        filterInputRef.current?.focus();
      },
    });

    useEffect(() => {
      document.body.addEventListener('keydown', handleKeydown);

      return () => {
        document.body.removeEventListener('keydown', handleKeydown);
      };
    }, [handleKeydown]);

    const isNearBottomOfScreen = () => {
      if (!dropdownContainerRef.current) {
        return false;
      }

      const bodyHeight = document.body.getBoundingClientRect().height;
      const dropdownTop =
        dropdownContainerRef.current.getBoundingClientRect().top;

      return dropdownTop > bodyHeight - 200;
    };

    // Recalculate the position of the dropdown
    useLayoutEffect(() => {
      if (!open || !dropdownListRef.current) {
        return;
      }

      // Compute the size of all the menus
      const dropdownBtnRect =
        dropdownContainerRef.current?.getBoundingClientRect();
      if (!dropdownBtnRect) {
        return;
      }
      const bodyRect = document.body.getBoundingClientRect();
      const dropdownListRect = dropdownListRef.current.getBoundingClientRect();

      // Reset all the things so we can start fresh
      dropdownListRef.current.style.left = 'initial';
      dropdownListRef.current.style.right = 'initial';
      dropdownListRef.current.style.top = 'initial';
      dropdownListRef.current.style.bottom = 'initial';
      dropdownListRef.current.style.minWidth = 'initial';
      dropdownListRef.current.style.maxWidth = 'initial';

      const screenMargin = 6;
      if (right || wide) {
        // Prevent dropdown from squishing against left side of screen
        const rightMargin = Math.max(
          dropdownListRect.width + screenMargin,
          dropdownBtnRect.right
        );

        const offset = beside ? dropdownBtnRect.width - 40 : 0;
        dropdownListRef.current.style.right = `${bodyRect.width - rightMargin + offset
        }px`;
        dropdownListRef.current.style.maxWidth = `${Math.min(
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
        dropdownListRef.current.style.left = `${leftMargin + offset}px`;
        dropdownListRef.current.style.maxWidth = `${Math.min(
          dropdownListRect.width,
          bodyRect.width - leftMargin - offset
        )}px`;
      }

      if (isNearBottomOfScreen()) {
        dropdownListRef.current.style.bottom = `${bodyRect.height - dropdownBtnRect.top
        }px`;
        dropdownListRef.current.style.maxHeight = `${dropdownBtnRect.top - screenMargin
        }px`;
      } else {
        dropdownListRef.current.style.top = `${dropdownBtnRect.bottom}px`;
        dropdownListRef.current.style.maxHeight = `${bodyRect.height - dropdownBtnRect.bottom - screenMargin
        }px`;
      }
    }, [beside, open, right, wide, uniquenessKey]);

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
      if (dropdownContainerRef.current) {
        const button = dropdownContainerRef.current.querySelector('button');

        button?.focus();
      }

      setOpen(false);

      onHide?.();
    }, [onHide]);

    const show = useCallback(
      (filterVisible = false) => {
        setOpen(true);
        setFilterVisible(filterVisible);
        setFilter('');
        setFilterItems(null);
        setFilterActiveIndex(-1);
        setUniquenessKey(uniquenessKey + 1);

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
        const dropdownsContainer =
          document.getElementById(dropdownsContainerId);

        if (!dropdownsContainer) {
          console.error(
            'Dropdown: a #dropdowns-container element is required for a dropdown to render properly'
          );

          return null;
        }

        finalChildren = [
          dropdownButtons[0],
          ReactDOM.createPortal(
            <div
              onKeyDown={handleKeydown}
              key="item"
              className={menuClasses}
              aria-hidden={!open}
            >
              <div className="dropdown__backdrop theme--transparent-overlay" />
              <div
                key={uniquenessKey}
                ref={dropdownListRef}
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
                    ref={filterInputRef}
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
    }, [
      _handleChangeFilter,
      _handleCheckFilterSubmit,
      children,
      filter,
      filterActiveIndex,
      filterItems,
      filterVisible,
      handleKeydown,
      menuClasses,
      open,
      uniquenessKey,
    ]);

    return (
      <div
        style={style}
        className={classes}
        ref={dropdownContainerRef}
        onClick={_handleClick}
        tabIndex={-1}
        onMouseDown={_handleMouseDown}
      >
        {dropdownChildren}
      </div>
    );
  }
);

Dropdown.displayName = 'Dropdown';
