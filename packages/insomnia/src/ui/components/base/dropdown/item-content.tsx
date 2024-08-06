import React, { type CSSProperties, type FC, type PropsWithChildren, type ReactNode } from 'react';
import styled from 'styled-components';

import type { PlatformKeyCombinations } from '../../../../common/settings';
import { svgPlacementHack } from '../../dropdowns/dropdown-placement-hacks';
import { SvgIcon } from '../../svg-icon';
import { PromptButton } from '../prompt-button';
import { DropdownHint } from './dropdown-hint';

const Checkmark = styled(SvgIcon)({
  '&&': {
    ...svgPlacementHack,
    '& svg': {
      fill: 'var(--color-surprise)',
    },
  },
});

type ItemContentProps = PropsWithChildren<{
  icon?: string | ReactNode;
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
      <div className='flex items-center w-full'>
        {icon && typeof icon === 'string' ? <i
          className={`fa fa-${icon} flex items-center`}
          style={{
            padding: '0 var(--padding-xs)',
            width: 'unset',
            ...iconStyle,
          }}
        /> : icon}
        {children || label}
      </div>
      {hint && <DropdownHint keyBindings={hint} />}
      {isSelected && <Checkmark icon="checkmark" />}
    </>
  );

  if (withPrompt) {
    return (
      <PromptButton
        fullWidth
        className={`w-full h-full flex items-center justify-between pl-1 pr-2 ${className || ''}`}
        onClick={onClick}
      >
        {content}
      </PromptButton>
    );
  }

  return (
    <div
      role='button'
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 'var(--padding-md)',
        paddingLeft: 'var(--padding-sm)',
        background: isSelected ? 'var(--hl-xs)' : 'initial',
        fontWeight: isSelected ? 'bold' : 'normal',
        ...style,
      }}
    >
      {content}
    </div>
  );
};
