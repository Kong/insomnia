import type { FC } from 'react';
import { Button, Separator, Tooltip, TooltipTrigger } from 'react-aria-components';

import { Icon } from '../icon';

export const LocalProjectBar: FC = () => {
  return (
    <div className="flex h-[--line-height-sm] w-full items-center justify-between gap-2 px-[--padding-md] text-sm text-[--color-font] ring-1 ring-transparent transition-all">
      <Icon icon="laptop" className="size-4" />
      <Separator orientation="vertical" className="h-5 border border-solid border-[--hl-sm] bg-[--color-bg]" />
      <span className="flex-1 truncate">Local Vault project</span>
      <TooltipTrigger delay={0}>
        <Button className="cursor-default">
          <Icon icon="question-circle" />
        </Button>
        <Tooltip
          offset={8}
          className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
        >
          Stored locally only, with no cloud. Ideal when collaboration is not needed.
        </Tooltip>
      </TooltipTrigger>
    </div>
  );
};
