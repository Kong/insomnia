import { useEffect } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';

import { useInsomniaSyncPullRemoteFileActionFetcher } from '~/routes/organization.$organizationId.insomnia-sync.pull-remote-file';
import { showToast } from '~/ui/components/toast-notification';

import { Icon } from '../../icon';
import {
  ACTIVE_BORDER_CLASS,
  GUIDE_LINE_CSS,
  ICON_CLASS,
  ROW_CLASS,
  TOGGLE_BTN_CLASS,
} from './project-navigation-sidebar-utils';
import type { UnsyncedWorkspaceFlatItem } from './types';

export const UnsyncedWorkspaceNode = ({ item }: { item: UnsyncedWorkspaceFlatItem }) => {
  const pullRemoteFileFetcher = useInsomniaSyncPullRemoteFileActionFetcher();
  const isPulling = pullRemoteFileFetcher.state !== 'idle';

  useEffect(() => {
    if (
      pullRemoteFileFetcher.data &&
      'error' in pullRemoteFileFetcher.data &&
      pullRemoteFileFetcher.data.error &&
      pullRemoteFileFetcher.state === 'idle'
    ) {
      const error: string =
        pullRemoteFileFetcher.data.error || `An unexpected error occurred while fetching remote file ${item.doc.name}.`;
      showToast({
        title: 'Failed to fetch remote workspace',
        icon: 'star',
        status: 'error',
        description: `Failed to fetch remote workspace: ${error}`,
      });
    }
  }, [pullRemoteFileFetcher.data, pullRemoteFileFetcher.state, item.doc.name]);

  return (
    <div
      className={`${ROW_CLASS} group`}
      style={{ paddingLeft: '2em' }}
      data-testid={`unsynced-workspace-node-${item.doc.name}`}
    >
      <span className={ACTIVE_BORDER_CLASS} />
      <span className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm)`} style={{ left: '1.5em' }} />
      <Button slot="drag" className="hidden" />
      <Button className={TOGGLE_BTN_CLASS} aria-label="" isDisabled />
      <TooltipTrigger>
        <Button
          onPress={() => {
            const { project, doc, organizationId } = item;
            const { remoteId: backendProjectId } = doc;
            if (project.remoteId && backendProjectId) {
              pullRemoteFileFetcher.submit({
                backendProjectId,
                remoteId: project.remoteId,
                organizationId,
              });
            }
          }}
          isDisabled={isPulling}
          className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left opacity-60 transition-colors ${isPulling ? 'animate-pulse cursor-not-allowed' : ''}`}
          aria-label="Fetch unsynced workspace"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-sm px-2">
            <Icon icon={isPulling ? 'spinner' : 'cloud-download'} className={ICON_CLASS} spin={isPulling} />
          </div>
          <span className="text-base text-[rgb(var(--color-font-rgb),0.8)]">{item.doc.name}</span>
        </Button>
        <Tooltip
          placement="top"
          className="flex max-h-[85vh] min-w-max items-center gap-2 overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
        >
          Click to fetch this file
        </Tooltip>
      </TooltipTrigger>
    </div>
  );
};
