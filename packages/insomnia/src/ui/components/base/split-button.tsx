import React, { cloneElement, useContext } from 'react';
import { Children, isValidElement, PropsWithChildren, ReactElement, ReactNode, useRef, useState } from 'react';

import { Dropdown } from './dropdown/dropdown';
import { DropdownButton } from './dropdown/dropdown-button';
import { DropdownItem } from './dropdown/dropdown-item';

interface UseSplitButton {
  selected: number;
  disabled: boolean;
  selectButton(index: number): void;
}
const SplitButtonContext = React.createContext<UseSplitButton | undefined>(undefined);
function useSplitButton(): UseSplitButton {
  const context = useContext(SplitButtonContext);
  if (context === undefined) {
    throw new Error('useSplitButton must be used within <SplitButton />');
  }
  return context;
}

function mapChildren(children: ReactNode, disabled: boolean): ReactElement[] {
  return Children
    .toArray(children)
    .filter(isValidElement)
    .filter((child: ReactElement) => child.type === 'button')
    .map((child: ReactElement) => cloneElement(child, { ...child.props, disabled: child.props.disabled || disabled }));
}

const SplitGroup = ({ children }: { children: ReactElement[] }) => {
  const { selected, selectButton, disabled } = useSplitButton();
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
      // TODO: fix this key mapping. Maybe require button to take name attribute and use it?
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
  const { selected, disabled } = useSplitButton();
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

export const SplitButton = ({ disabled, children, selected: defaultSelected = 0 }: PropsWithChildren<{ disabled?: boolean; selected?: number }>) => {
  const [selected, setSelected] = useState<number>(defaultSelected);
  const selectButton = (index: number) => {
    setSelected(index);
  };

  // you can use useMemo if performance is concerned, but most likely premature optimization.
  const value = { selected, disabled: Boolean(disabled), selectButton };
  return (
    <SplitButtonContext.Provider value={value}>
      <SplitButtonWrapper>{children}</SplitButtonWrapper>
    </SplitButtonContext.Provider>
  );
};
