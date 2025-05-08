import React from 'react';
import { Button } from 'react-aria-components';

export const ToggleBtn = (props: { isHidden: boolean; onShowHideInput: () => void }) => {
  const { isHidden, onShowHideInput } = props;
  return (
    <Button
      className="flex h-8 min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
      onPress={onShowHideInput}
    >
      {isHidden ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
    </Button>
  );
};
