import classnames from 'classnames';
import React, { FC, ReactNode, useCallback } from 'react';
import styled, { css } from 'styled-components';

export interface DropdownItemProps {
  buttonClass?: string;
  stayOpenAfterClick?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  className?: string;
  color?: string;
  selected?: boolean;
  onClick: (value: any, e: React.MouseEvent<HTMLButtonElement>) => void;
  value?: any;
}

const StyledButton = styled.button<{ selected?: boolean }>`
  display: flex;
  align-items: center;
  min-width: 15rem;
  font-size: var(--font-size-md);
  text-align: left;
  padding-right: var(--padding-md);
  padding-left: var(--padding-sm);
  height: var(--line-height-xs);
  width: 100%;
  color: var(--color-font) !important;
  background-color: var(--color-bg);
  white-space: nowrap;
  margin: 0;
  border: 0;

  &:hover:not(:disabled),
  &:active:not(:disabled) {
    background: var(--hl-xs);
  }

  &:active:not(:disabled) {
    background: var(--hl-md);
  }

  ${({ selected }) => selected && css`
    background: var(--hl-xs) !important;
    font-weight: bold;
  `};

  &:disabled {
    opacity: 0.5;
  }
`;

const StyledRightNode = styled.span`
  display: flex;
  align-items: center;
  color: var(--hl-xl);
  margin-left: auto;
  padding-left: var(--padding-lg);
`;

const StyledInner = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  flex-direction: row;
`;

const StyledText = styled.div`
  white-space: nowrap;
  display: flex;
  align-items: center;
  & > *:not(:first-child) {
    margin-left: 0.3em;
  }
  input + label {
    padding-top: 0px !important;
  }
`;

const StyledIconContainer = styled.div`
  display: flex;
  align-items: center;
  padding-left: var(--padding-xs);
  padding-right: var(--padding-md);
`;

export const DropdownItem: FC<DropdownItemProps> = ({
  buttonClass,
  children,
  className,
  color,
  disabled,
  right,
  icon,
  selected,
  onClick,
  stayOpenAfterClick,
  value,
}) => {
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (stayOpenAfterClick) {
      event.stopPropagation();
    }
    if (!onClick || disabled) {
      return;
    }
    onClick(value, event);
  }, [stayOpenAfterClick, disabled, value, onClick]);

  const styles = color ? { color } : {};

  return (
    <StyledButton
      className={classnames(className, buttonClass)}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      selected={selected}
    >
      {icon && <StyledIconContainer>{icon}</StyledIconContainer>}
      <StyledInner className={className}>
        <StyledText style={styles}>{children}</StyledText>
      </StyledInner>
      {right && <StyledRightNode>{right}</StyledRightNode>}
    </StyledButton>
  );
};
