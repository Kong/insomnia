import { PressResponder } from '@react-aria/interactions';
import { Item, Section } from '@react-stately/collections';
import { AriaButtonProps } from '@react-types/button';
import type { AriaMenuProps, MenuTriggerProps } from '@react-types/menu';
import type { Placement } from '@react-types/overlays';
import classNames from 'classnames';
import React, { CSSProperties, forwardRef, PropsWithChildren, ReactNode, useRef } from 'react';
import { useMenuTrigger } from 'react-aria';
import { mergeProps, useButton, useFocusRing } from 'react-aria';
import { MenuTriggerState, useMenuTriggerState } from 'react-stately';
import styled from 'styled-components';

import { PlatformKeyCombinations } from '../../../../common/settings';
import { Button as ThemedButton, ButtonProps } from '../../themed-button';
import { DropdownHint } from './dropdown-hint';
import { Menu } from './menu';
import { Popover } from './popover';

export interface DropdownHandle {
  show: (filterVisible?: boolean) => void;
  hide: () => void;
  toggle: (filterVisible?: boolean) => void;
}

const Container = styled.div({
  position: 'relative',
  display: 'inline-block',
});

export interface DropdownProps extends AriaMenuProps<any>, MenuTriggerProps {
  label?: string;
  triggerButton?: ReactNode;
  placement?: Placement;
  className?: string;
  style?: CSSProperties;
  onOpen?: () => void;
  dataTestId?: string;
  isDisabled?: boolean;
}

const Dropdown = forwardRef<DropdownHandle, DropdownProps>((props: DropdownProps, ref: any) => {
  const {
    placement,
    triggerButton,
    className,
    label,
    selectionMode = 'multiple',
    closeOnSelect = false,
    style,
    dataTestId = 'DropdownButton',
    isDisabled = false,
    onOpen,
  } = props;

  const state: MenuTriggerState = useMenuTriggerState({
    ...props,
    closeOnSelect: selectionMode === 'multiple' || closeOnSelect,
    onOpenChange: isOpen => isOpen && onOpen?.(),
  });

  const triggerRef = useRef<HTMLButtonElement>(ref);

  const { menuTriggerProps, menuProps } = useMenuTrigger({ isDisabled }, state, triggerRef);

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
});

Dropdown.displayName = 'Dropdown';

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
  style?: CSSProperties;
  onClick?: () => void;
}>;

const ItemContent = ({ icon, label, hint, className, onClick, children, iconStyle, style }: ItemContentProps) => (
  <StyledItemContainer className={className} role='button' onClick={onClick} style={style}>
    <StyledItemContent>
      {icon && <StyledIcon icon={icon} style={iconStyle} />}
      {children || label}
    </StyledItemContent>
    {hint && <DropdownHint keyBindings={hint} />}
  </StyledItemContainer>
);

interface StyledThemedButtonProps extends ButtonProps {
  removePaddings?: boolean;
  removeBorderRadius?: boolean;
  disableHoverBehavior?: boolean;
}

const StyledThemedButton = styled(ThemedButton).attrs((props: StyledThemedButtonProps) => ({
  variant: props.variant || 'text',
  size: props.size || 'small',
  radius: props.removeBorderRadius ? 0 : props.radius || '3px',
}))`
  height: 100%;
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  padding: ${({ removePaddings = true }) =>
    removePaddings ? 0 : 'var(--padding-xs) var(--padding-sm)'
};

  &:focus,
  &:hover {
    &:not(:disabled) {
      ${({ variant = 'text', bg, disableHoverBehavior = true }) => {
    if (!disableHoverBehavior) {
      return;
    }

    if (variant === 'contained') {
      return 'box-shadow: unset';
    }

    if (bg === 'default') {
      return 'background-color: unset';
    }

    return 'background-color: unset';
  }};
    }
  }

  &:active:not(:disabled) {
    ${({ variant, bg, disableHoverBehavior }) => {
    if (!disableHoverBehavior) {
      return;
    }

    if (variant === 'contained') {
      return 'box-shadow: unset';
    }

    if (bg === 'default') {
      return 'background-color: unset';
    }

    return 'background-color: unset';
  }}
  }
`;

type DropdownButtonProps = {
  className?: string;
  isPressed?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  isDisabled?: boolean;
} & ButtonProps & AriaButtonProps & StyledThemedButtonProps;

const DropdownButton = forwardRef<{}, DropdownButtonProps>((props: DropdownButtonProps, ref: any) => {
  const buttonRef = useRef(ref);
  const { buttonProps, isPressed } = useButton({ ...props, onPress: props.onClick }, buttonRef);
  const { focusProps } = useFocusRing();

  return (
    <StyledThemedButton
      ref={buttonRef}
      style={props.style}
      isPressed={isPressed || props.isPressed}
      variant={props.variant || 'text'}
      size={props.size || 'small'}
      {...mergeProps(buttonProps, focusProps, props)}
    >
      {props.children}
    </StyledThemedButton>
  );
});

DropdownButton.displayName = 'DropdownButton';

export { Dropdown, Item as DropdownItem, Section as DropdownSection, ItemContent, DropdownButton };
