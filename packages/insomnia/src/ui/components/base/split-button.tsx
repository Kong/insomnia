import React, { cloneElement, useContext } from 'react';
import { Children, isValidElement, PropsWithChildren, ReactElement, ReactNode, useRef, useState } from 'react';

import { Dropdown } from './dropdown/dropdown';
import { DropdownButton } from './dropdown/dropdown-button';
import { DropdownItem } from './dropdown/dropdown-item';

const SplitButtonContext = React.createContext({});
const { Provider } = SplitButtonContext;
const SplitButtonProvider = ({ disabled, children, selected: defaultSelected }: PropsWithChildren<{ selected: number; disabled: boolean }>) => {
  const [selected, setSelected] = useState<number>(defaultSelected);

  const selectButton = (index: number) => {
    setSelected(index);
  };

  return (
    <Provider value={{ selectButton, selected, disabled }}>{children}</Provider>
  );
};

function mapChildren(children: ReactNode, disabled: boolean): ReactElement[] {
  return Children
    .toArray(children)
    .filter(isValidElement)
    .filter((child: ReactElement) => child.type === 'button')
    .map((child: ReactElement) => cloneElement(child, { ...child.props, disabled: child.props.disabled || disabled }));
}

const SplitGroup = ({ children }: { children: ReactElement[] }) => {
  /** @ts-ignore */
  const { selected, selectButton, disabled } = useContext(SplitButtonContext);
  const dropdownRef = useRef<Dropdown>(null);
  const dropdowns = children.map((child: ReactElement, index: number) => {
    const { onClick: onButtonClick } = child.props;
    const onClick = () => {
      if (index === selected) {
        onButtonClick();
        return;
      }

      selectButton(index);
    };

    return (
      // eslint-disable-next-line react/jsx-key
      <DropdownItem
        {...child.props}
        onClick={onClick}
        selected={selected === index}
      >
        {child.props.children}
      </DropdownItem>
    );
  });
  return (
    <Dropdown key="dropdown" className="tall" right ref={dropdownRef} disabled={disabled}>
      <DropdownButton
        disabled={disabled}
        className="urlbar__send-context"
        onClick={() => dropdownRef.current?.show()}
      >
        <i className="fa fa-caret-down" />
      </DropdownButton>
      {dropdowns}
    </Dropdown>
  );
};

const SplitButtonWrapper = ({ children }: PropsWithChildren<{ selected?: number }>) => {
  /** @ts-ignore */
  const { selected, disabled } = useContext(SplitButtonContext);
  const buttons = mapChildren(children, disabled);

  if (buttons.length < selected + 1) {
    throw new Error('the button count should be bigger than the selected index');
  }

  return (
    <div>
      {buttons[selected]}
      <SplitGroup>{buttons}</SplitGroup>
    </div>
  );
};

export const SplitButton = ({ disabled, children, selected = 0 }: PropsWithChildren<{ disabled?: boolean; selected?: number }>) => {
  return (
    <SplitButtonProvider selected={selected} disabled={Boolean(disabled)}>
      <SplitButtonWrapper>{children}</SplitButtonWrapper>
    </SplitButtonProvider>
  );
};
