import type { FC } from 'react';
import { Button, Separator, Tooltip, TooltipTrigger } from 'react-aria-components';

import { Icon } from '../icon';

export const CloudSyncProjectBar: FC = () => {
  return (
    <div className="flex h-(--line-height-sm) w-full items-center gap-2 px-(--padding-md) text-sm text-(--color-font) ring-1 ring-transparent transition-all">
      <Icon icon="earth-americas" className="size-4" />
      <Separator orientation="vertical" className="h-5 border border-solid border-(--hl-sm) bg-(--color-bg)" />
      <span className="flex-1 truncate">Cloud Sync project</span>
      <TooltipTrigger delay={0}>
        <Button className="cursor-default">
          <Icon icon="question-circle" />
        </Button>
        <Tooltip
          offset={8}
          className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg focus:outline-hidden"
        >
          Encrypted and synced securely to the cloud. Ideal for out of the box collaboration.
        </Tooltip>
      </TooltipTrigger>
    </div>
  );
};
