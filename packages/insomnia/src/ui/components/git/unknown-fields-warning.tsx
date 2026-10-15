import type { FC } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';

import { Icon } from '~/ui/components/icon';
export const UnknownFieldsWarningIcon: FC = () => (
  <TooltipTrigger>
    <Button
      slot={null}
      aria-label="Unrecognized fields warning"
      className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-warning) ring-1 ring-transparent transition-all focus:ring-(--hl-md) focus:ring-inset"
    >
      <Icon icon="triangle-exclamation" aria-hidden pointerEvents="none" />
    </Button>
    <Tooltip
      offset={8}
      className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
    >
      This file includes fields not recognized by this version of Insomnia (i.e. fields that were added by a newer
      version of Insomnia, or manual file edits). Committing any changes to them from here may break or remove
      functionality for your collaborators.
    </Tooltip>
  </TooltipTrigger>
);
