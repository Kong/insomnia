import React, { cloneElement, useContext } from 'react';
import { Children, isValidElement, PropsWithChildren, ReactElement, ReactNode, useRef, useState } from 'react';

import { Dropdown } from '../dropdown/dropdown';
import { DropdownButton } from '../dropdown/dropdown-button';
import { DropdownItem } from '../dropdown/dropdown-item';

interface UseSplitButton {
  disabled: boolean;
  buttonIndex: number;
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

function mapButtons(children: ReactNode, disabled: boolean): ReactElement[] {
  return Children
    .toArray(children)
    .filter(isValidElement)
    .filter((child: ReactElement) => child.type === 'button')
    .map((child: ReactElement) => {
      const props = {
        ...child.props,
        // disable when an individual button option has to be disabled or disable ALL when the split button itself needs to be disabled
        disabled: child.props.disabled || disabled,
      };
      return cloneElement(child, props);
    });
}

const SplitGroup = ({ children }: { children: ReactElement[] }) => {
  const { buttonIndex, selectButton, disabled } = useSplitButton();
  const dropdownRef = useRef<Dropdown>(null);
  const dropdowns = children.map((child: ReactElement, index: number) => {
    const { onClick: onButtonClick } = child.props;
    const onClick = () => {
      if (index === buttonIndex) {
        onButtonClick();
        return;
      }

      selectButton(index);
    };

    // TODO: reset the min width for the dropdown item for split button
    return (
      <DropdownItem
        key={child.props.name}
        {...child.props}
        onClick={onClick}
        selected={buttonIndex === index}
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

const SplitButtonWrapper = ({ children }: { children: ReactNode }) => {
  const { buttonIndex, disabled } = useSplitButton();
  const buttons = mapButtons(children, disabled);

  if (buttons.length < buttonIndex + 1) {
    throw new Error('the button count should be bigger than the selected index');
  }

  return (
    <div>
      {buttons[buttonIndex]}
      <SplitGroup>{buttons}</SplitGroup>
    </div>
  );
};

// TODO: enforce children to be only button type or props extending HTMLButtonElement props
export const SplitButton = ({
  disabled,
  buttonIndex: defaultIndex = 0,
  children,
}: PropsWithChildren<{ disabled?: boolean; buttonIndex?: number }>) => {
  const [buttonIndex, setButtonIndex] = useState<number>(defaultIndex);
  const selectButton = (index: number) => {
    setButtonIndex(index);
  };

  // you can use useMemo if performance is concerned, but most likely premature optimization.
  const value = { buttonIndex, disabled: Boolean(disabled), selectButton };
  return (
    <SplitButtonContext.Provider value={value}>
      <SplitButtonWrapper>{children}</SplitButtonWrapper>
    </SplitButtonContext.Provider>
  );
};
