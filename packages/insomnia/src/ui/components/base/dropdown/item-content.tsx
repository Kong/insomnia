import React, { type CSSProperties, type FC, type PropsWithChildren, type ReactNode } from 'react';

import type { PlatformKeyCombinations } from '../../../../common/settings';
import { SvgIcon } from '../../svg-icon';
import { PromptButton } from '../prompt-button';
import { DropdownHint } from './dropdown-hint';

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
          className={`fa fa-${icon} flex items-center px-[--padding-xs]`}
          style={iconStyle}
        /> : icon}
        {children || label}
      </div>
      {hint && <DropdownHint keyBindings={hint} />}
      {isSelected && <SvgIcon icon="checkmark" />}
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
      className={`w-full h-full flex items-center justify-between pl-[--padding-sm] pr-[--padding-md] ${className || ''} ${isSelected ? 'bg-[--hl-xs] font-bold' : ''}`}
      style={style}
    >
      {content}
    </div>
  );
};
