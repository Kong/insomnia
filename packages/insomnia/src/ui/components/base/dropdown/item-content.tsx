import classNames from 'classnames';
import React, { CSSProperties, FC, PropsWithChildren, ReactNode } from 'react';
import styled from 'styled-components';

import { PlatformKeyCombinations } from '../../../../common/settings';
import { svgPlacementHack } from '../../dropdowns/dropdown-placement-hacks';
import { SvgIcon } from '../../svg-icon';
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

interface ContainerProps {
  isSelected?: boolean;
}

const StyledItemContainer = styled.div<ContainerProps>(props => ({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingRight: 'calc(1rem * 1.2)',
  paddingLeft: 'calc(1rem * 0.6)',
  background: props.isSelected ? 'var(--hl-xs)' : 'initial',
  fontWeight: props.isSelected ? 'bold' : 'normal',
}));

const StyledItemPromptContainer = styled(PromptButton)({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingRight: 'calc(1rem * 1.2)',
  paddingLeft: 'calc(1rem * 0.6)',
});

const StyledItemContent = styled.div({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
});

const Checkmark = styled(SvgIcon)({
  '&&': {
    ...svgPlacementHack,
    '& svg': {
      fill: 'var(--color-surprise)',
    },
  },
});

type ItemContentProps = PropsWithChildren<{
  icon?: string;
  label?: string | ReactNode;
  hint?: PlatformKeyCombinations;
  className?: string;
  iconStyle?: CSSProperties;
  style?: CSSProperties;
  withPrompt?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  stayOpenAfterClick?: boolean;
  onClick?: () => void;
}>;

export const ItemContent: FC<ItemContentProps> = (props: ItemContentProps) => {
  const { icon, label, hint, className, withPrompt, children, iconStyle, style, isSelected, onClick } = props;

  const content = (
    <>
      <StyledItemContent>
        {icon && <StyledIcon icon={icon} style={iconStyle} />}
        {children || label}
      </StyledItemContent>
      {hint && <DropdownHint keyBindings={hint} />}
      {isSelected && <Checkmark icon="checkmark" />}
    </>
  );

  if (withPrompt) {
    return (
      <StyledItemPromptContainer
        fullWidth
        className={className}
        onClick={onClick}
      >
        {content}
      </StyledItemPromptContainer>
    );
  }

  return (
    <StyledItemContainer
      role='button'
      className={className}
      style={style}
      isSelected={isSelected}
    >
      {content}
    </StyledItemContainer>
  );
};
