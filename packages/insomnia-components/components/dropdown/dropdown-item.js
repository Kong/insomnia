import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import styled from 'styled-components';

const StyledButton = styled.button`
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

  & > *:not(:first-child) {
    margin-left: 0.3em;
  }
`;

const StyledIconContainer = styled.div`
  display: flex;
  align-items: center;
  padding-left: var(--padding-xs);
  padding-right: var(--padding-md);
`;

@autobind
class DropdownItem extends PureComponent {
  _handleClick(e) {
    const { stayOpenAfterClick, onClick, disabled } = this.props;

    if (stayOpenAfterClick) {
      e.stopPropagation();
    }

    if (!onClick || disabled) {
      return;
    }

    if (this.props.hasOwnProperty('value')) {
      onClick(this.props.value, e);
    } else {
      onClick(e);
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
      onClick, // eslint-disable-line no-unused-vars
      stayOpenAfterClick, // eslint-disable-line no-unused-vars
      ...props
    } = this.props;

    const styles = color ? { color } : {};

    const inner = (
      <StyledInner className={className}>
        <StyledText style={styles}>{children}</StyledText>
      </StyledInner>
    );

    return (
      <StyledButton
        className={buttonClass}
        type="button"
        onClick={this._handleClick}
        disabled={disabled}
        {...props}>
        {icon && <StyledIconContainer>{icon}</StyledIconContainer>}
        {inner}
        {right && <StyledRightNode>{right}</StyledRightNode>}
      </StyledButton>
    );
  }
}

DropdownItem.propTypes = {
  buttonClass: PropTypes.any,
  stayOpenAfterClick: PropTypes.bool,
  value: PropTypes.any,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node,
  icon: PropTypes.node,
  right: PropTypes.node,
  className: PropTypes.string,
  color: PropTypes.string,
};

export default DropdownItem;
