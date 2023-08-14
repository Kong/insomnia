import { PressResponder } from '@react-aria/interactions';
import type { AriaMenuProps, MenuTriggerProps } from '@react-types/menu';
import type { Placement } from '@react-types/overlays';
import classnames from 'classnames';
import React, { CSSProperties, forwardRef, ReactNode, useImperativeHandle, useRef } from 'react';
import { mergeProps, useMenuTrigger } from 'react-aria';
import { MenuTriggerState, useMenuTriggerState } from 'react-stately';
import styled from 'styled-components';

import { DropdownButton } from './dropdown-button';
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
  dataTestId?: string;
  isDisabled?: boolean;
  onOpen?: () => void;
  closeOnSelect?: boolean;
}

export const Dropdown = forwardRef<DropdownHandle, DropdownProps>((props: DropdownProps, ref: any) => {
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
    onClose,
  } = props;

  const state: MenuTriggerState = useMenuTriggerState({
    ...props,
    onOpenChange: isOpen => isOpen ? onOpen?.() : onClose?.(),
  });

  useImperativeHandle(ref, () => ({
    show: () => state.open(),
    hide: () => state.close(),
    toggle: () => state.toggle(),
  }));

  const triggerRef = useRef<HTMLButtonElement>(ref);

  const { menuTriggerProps, menuProps } = useMenuTrigger({ isDisabled }, state, triggerRef);
  return (
    <Container className={classnames('dropdown', className)} style={style} data-testid={dataTestId}>
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
            {...mergeProps(props, menuProps)}
            selectionMode={selectionMode}
            closeOnSelect={props.closeOnSelect}
            autoFocus={state.focusStrategy || true}
          />
        </Popover>
      )}
    </Container>
  );
});

Dropdown.displayName = 'Dropdown';
