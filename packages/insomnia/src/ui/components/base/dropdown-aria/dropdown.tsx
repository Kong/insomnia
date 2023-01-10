import { PressResponder } from '@react-aria/interactions';
import { Item, Section } from '@react-stately/collections';
import { AriaButtonProps } from '@react-types/button';
import type { AriaMenuProps, MenuTriggerProps } from '@react-types/menu';
import type { Placement } from '@react-types/overlays';
import classNames from 'classnames';
import { PlatformKeyCombinations } from 'insomnia-common';
import React, { CSSProperties, forwardRef, PropsWithChildren, ReactNode, useRef } from 'react';
import { useMenuTrigger } from 'react-aria';
import { mergeProps, useButton, useFocusRing } from 'react-aria';
import { MenuTriggerState, useMenuTriggerState } from 'react-stately';
import styled from 'styled-components';

import { Button as ThemedButton, ButtonProps } from '../../themed-button';
import { DropdownHint } from './dropdown-hint';
import { Menu } from './menu';
import { Popover } from './popover';

const Container = styled.div({
  position: 'relative',
  display: 'inline-block',
});

interface Props extends AriaMenuProps<any>, MenuTriggerProps {
  label?: string;
  triggerButton?: ReactNode;
  placement?: Placement;
  className?: string;
  style?: CSSProperties;
  onOpen?: () => void;
  dataTestId?: string;
  disabled?: boolean;
}

const Dropdown = (props: Props) => {
  const {
    placement,
    triggerButton,
    className,
    label,
    selectionMode = 'multiple',
    closeOnSelect = false,
    style,
    dataTestId = 'DropdownButton',
    // disabled,
    onOpen,
  } = props;

  const state: MenuTriggerState = useMenuTriggerState({
    ...props,
    closeOnSelect: selectionMode === 'multiple' || closeOnSelect,
    onOpenChange: isOpen => isOpen && onOpen?.(),
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const { menuTriggerProps, menuProps } = useMenuTrigger({}, state, triggerRef);

  return (
    <Container className={className} style={style} data-testid={dataTestId}>
      <PressResponder {...menuTriggerProps} isPressed={state.isOpen} ref={triggerRef}>
        {triggerButton || <DropdownButton>{label} <span aria-hidden="true" style={{ paddingLeft: 5 }}>?</span></DropdownButton>}
      </PressResponder>

      {state.isOpen && (
        <Popover
          state={state}
          triggerRef={triggerRef}
          placement={placement || 'bottom end'}
        >
          <Menu
            {...menuProps}
            {...props}
            selectionMode={selectionMode}
            autoFocus={state.focusStrategy || true}
            onClose={() => state.close()}
          />
        </Popover>
      )}
    </Container>
  );
};
interface StyledIconProps {
  icon: string;
}

const StyledIcon = styled.i.attrs<StyledIconProps>(props => ({
  className: classNames('fa', `fa-${props.icon}`),
}))<StyledIconProps>({
  display: 'flex',
  alignItems: 'center',
  padding: '0 var(--padding-xs)',
  width: 'unset',
});

const StyledItemContainer = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
});

const StyledItemContent = styled.div({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
});

type ItemContentProps = PropsWithChildren<{
  icon?: string;
  label?: string | ReactNode;
  hint?: PlatformKeyCombinations;
  className?: string;
  iconStyle?: CSSProperties;
  onClick?: () => void;
}>;

const ItemContent = ({ icon, label, hint, className, onClick, children, iconStyle }: ItemContentProps) => (
  <StyledItemContainer className={className} role='button' onClick={onClick}>
    <StyledItemContent>
      {icon && <StyledIcon icon={icon} style={iconStyle} />}
      {children || label}
    </StyledItemContent>
    {hint && <DropdownHint keyBindings={hint} />}
  </StyledItemContainer>
);

type DropdownButtonProps = {
  className?: string;
  isPressed?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
} & ButtonProps & AriaButtonProps;

const DropdownButton = forwardRef<{}, DropdownButtonProps>((props: DropdownButtonProps, ref: any) => {
  const buttonRef = useRef(ref);
  const { buttonProps, isPressed } = useButton({ ...props, onPress: props.onClick }, buttonRef);
  const { focusProps } = useFocusRing();

  return (
    <ThemedButton
      ref={buttonRef}
      style={props.style}
      isPressed={isPressed || props.isPressed}
      {...mergeProps(buttonProps, focusProps, props)}
    >
      {props.children}
    </ThemedButton>
  );
});

DropdownButton.displayName = 'DropdownButton';

export { Dropdown, Item as DropdownItem, Section as DropdownSection, ItemContent, DropdownButton };
