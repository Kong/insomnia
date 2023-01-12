import classNames from 'classnames';
import React, { CSSProperties, FC, PropsWithChildren, ReactNode } from 'react';
import styled from 'styled-components';

import { PlatformKeyCombinations } from '../../../../common/settings';
import { PromptButton } from '../prompt-button';
import { DropdownHint } from './dropdown-hint';

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

export const ItemContent: FC<ItemContentProps> = (props: ItemContentProps) => {
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
