import { PressResponder } from '@react-aria/interactions';
import type { AriaMenuProps, MenuTriggerProps } from '@react-types/menu';
import type { Placement } from '@react-types/overlays';
import classNames from 'classnames';
import React, { CSSProperties, FC, forwardRef, PropsWithChildren, ReactNode, useRef } from 'react';
import { useMenuTrigger } from 'react-aria';
import { MenuTriggerState, useMenuTriggerState } from 'react-stately';
import styled from 'styled-components';

import { PlatformKeyCombinations } from '../../../../common/settings';
import { PromptButton } from '../prompt-button';
import { DropdownButton } from './dropdown-button';
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
    selectionMode,
    style,
    dataTestId = 'DropdownButton',
    isDisabled = false,
    onOpen,
  } = props;

  const state: MenuTriggerState = useMenuTriggerState({
    ...props,
    closeOnSelect: selectionMode === 'multiple' || false,
    onOpenChange: isOpen => isOpen && onOpen?.(),
  });

  const triggerRef = useRef<HTMLButtonElement>(ref);

  const { menuTriggerProps, menuProps } = useMenuTrigger({ isDisabled, type: 'listbox' }, state, triggerRef);

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
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const StyledItemPromptContainer = styled(PromptButton)({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
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
  withPrompt?: boolean;
  onClick?: () => void;
}>;

const ItemContent: FC<ItemContentProps> = (props: ItemContentProps) => {
  const { icon, label, hint, className, withPrompt, children, iconStyle, style, onClick } = props;

  if (withPrompt) {
    return (
      <StyledItemPromptContainer fullWidth onClick={onClick}>
        <StyledItemContent>
          {icon && <StyledIcon icon={icon} style={iconStyle} />}
          {children || label}
        </StyledItemContent>
        {hint && <DropdownHint keyBindings={hint} />}
      </StyledItemPromptContainer>
    );
  }

  return (
    <StyledItemContainer className={className} role='button' onClick={onClick} style={style}>
      <StyledItemContent>
        {icon && <StyledIcon icon={icon} style={iconStyle} />}
        {children || label}
      </StyledItemContent>
      {hint && <DropdownHint keyBindings={hint} />}
    </StyledItemContainer>
  );
};

export { Dropdown, ItemContent };
