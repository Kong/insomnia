import type { FC } from 'react';
import React from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';

import { Icon } from '../icon';

export const LocalProjectBar: FC = () => {
  return (
    <div className="flex h-[--line-height-sm] w-full items-center justify-between px-[--padding-md] text-sm text-[--color-font] ring-1 ring-transparent transition-all">
      <div className="flex items-center gap-2">
        <Icon icon="laptop" />
        <span className="local-project-bar__text">Local-only project</span>
      </div>
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
