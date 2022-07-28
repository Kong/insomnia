import React, { ButtonHTMLAttributes, cloneElement } from 'react';
import { Children, isValidElement, ReactElement, ReactNode, useRef, useState } from 'react';
import styled from 'styled-components';

import { Dropdown, DropdownHandle } from '../dropdown/dropdown';
import { DropdownButton } from '../dropdown/dropdown-button';
import { DropdownItem } from '../dropdown/dropdown-item';

const OptionsDropdown = styled(Dropdown)({
  display: 'flex',
  paddingRight: 'var(--padding-xs)',
  paddingLeft: 'var(--padding-xs)',
  textAlign: 'center',
  borderLeft: '1px solid var(--hl-md)',
});
const PrimaryButton = styled('button')({
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  textAlign: 'center',
  color: 'var(--color-font-surprise)',
});

// @TODO: this should be read from ThemeContext.Provider
const ColorMap: Record<ButtonColor, string> = {
  'primary': 'var(--color-surprise)',
};

const Container = styled('div')(({ color }: { color: ButtonColor }) => ({
  display: 'flex',
  color: 'white',
  backgroundColor: ColorMap[color],
}));

function mapButtons(children: ReactNode, disabled: boolean): ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>[] {
  return Children
    .toArray(children)
    .filter(isValidElement)
    .filter((child: ReactElement) => {
      if (!child.props.name) {
        throw new Error('<button /> should have the "name" attribute');
      }

      const isButton = child.type === 'button';
      if (!isButton) {
        throw new Error('<SplitButton /> should only have <button /> in its children');
      }
      return isButton;
    })
    .map((child: ReactElement) => {
      const props = {
        ...child.props,
        // disable when an individual button option has to be disabled or disable ALL when the split button itself needs to be disabled
        disabled: child.props.disabled || disabled,
      };
      return cloneElement(child, props);
    });
};

function mapOptions(
  buttons:  ReactElement<ButtonHTMLAttributes<HTMLButtonElement>>[],
  disabled: boolean,
  buttonIndex: number,
  selectButton: (index: number) => void,
): ReactElement[] {
  return buttons.map((child: ReactElement, index: number) => {
    const props = {
      ...child.props,
      // disable when an individual button option has to be disabled or disable ALL when the split button itself needs to be disabled
      disabled: child.props.disabled || disabled,
    };

    const onClick = () => {
      if (index === buttonIndex) {
        child.props.onClick();
        return;
      }

      selectButton(index);
    };

    // TODO: reset the min width for the dropdown item for split button
    return (
      <DropdownItem
        key={child.props.name}
        {...props}
        onClick={onClick}
        selected={buttonIndex === index}
        widthUnset
      >
        {child.props.children}
      </DropdownItem>
    );
  });
}

function mapSplitButtons(
  children: ReactNode,
  disabled: boolean,
  buttonIndex: number,
  selectButton: (index: number) => void
): [ReactElement, ReactElement[]] {
  const buttons = mapButtons(children, disabled);
  const primaryButton = buttons[buttonIndex];
  const options = mapOptions(buttons, disabled, buttonIndex, selectButton);
  return [<PrimaryButton {...primaryButton.props} />, options];
}

type ButtonColor = 'primary';
interface Props {
  disabled?: boolean;
  buttonIndex?: number;
  color?: ButtonColor;
  children: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>[];
}
export const SplitButton = ({
  disabled,
  buttonIndex: defaultIndex = 0,
  color = 'primary',
  children,
}: Props) => {
  const dropdownRef = useRef<DropdownHandle>(null);
  const [buttonIndex, setButtonIndex] = useState<number>(defaultIndex);
  const [primaryButton, buttonOptions] = mapSplitButtons(children, Boolean(disabled), buttonIndex, setButtonIndex);
  return (
    <Container color={color}>
      {primaryButton}
      <OptionsDropdown
        className="tall"
        right
        ref={dropdownRef}
        disabled={disabled}
      >
        <DropdownButton
          disabled={disabled}
          onClick={() => dropdownRef.current?.show()}
        >
          <i className="fa fa-caret-down" />
        </DropdownButton>
        {buttonOptions}
      </OptionsDropdown>
    </Container>
  );
};
