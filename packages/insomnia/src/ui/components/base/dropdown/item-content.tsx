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
      <div className="flex w-full items-center">
        {icon && typeof icon === 'string' ? (
          <i className={`fa fa-${icon} flex items-center px-(--padding-xs)`} style={iconStyle} />
        ) : (
          icon
        )}
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
        className={`flex h-full w-full items-center justify-between pr-2 pl-1 ${className || ''}`}
        onClick={onClick}
      >
        {content}
      </PromptButton>
    );
  }

  return (
    <div
      role="button"
      className={`flex h-full w-full items-center justify-between pr-(--padding-md) pl-(--padding-sm) ${className || ''} ${isSelected ? 'bg-(--hl-xs) font-bold' : ''}`}
      style={style}
    >
      {content}
    </div>
  );
};
