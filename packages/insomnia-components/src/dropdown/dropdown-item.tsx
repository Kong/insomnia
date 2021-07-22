import React, { PureComponent, ReactNode } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import styled, { css } from 'styled-components';

export interface DropdownItemProps {
  buttonClass?: string,
  stayOpenAfterClick?: boolean,
  value?: any,
  disabled?: boolean,
  onClick?: Function,
  children?: ReactNode,
  icon?: ReactNode,
  right?: ReactNode,
  className?: string,
  color?: string,
  selected?: boolean,
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

@autoBindMethodsForReact
export class DropdownItem extends PureComponent<DropdownItemProps> {
  _handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    const { stayOpenAfterClick, onClick, disabled } = this.props;

    if (stayOpenAfterClick) {
      event.stopPropagation();
    }

    if (!onClick || disabled) {
      return;
    }

    if (this.props.hasOwnProperty('value')) {
      onClick(this.props.value, event);
    } else {
      onClick(event);
    }
  }

  render() {
    const {
      buttonClass,
      children,
      className,
      color,
      disabled,
      right,
      icon,
      selected,
    } = this.props;

    const styles = color ? { color } : {};

    const inner = (
      <StyledInner className={className}>
        <StyledText style={styles}>{children}</StyledText>
      </StyledInner>
    );
    return (
      <StyledButton
        className={`${className} ${buttonClass}`.trim()}
        type="button"
        onClick={this._handleClick}
        disabled={disabled}
        selected={selected}>
        {icon && <StyledIconContainer>{icon}</StyledIconContainer>}
        {inner}
        {right && <StyledRightNode>{right}</StyledRightNode>}
      </StyledButton>
    );
  }
}
