import { useEffect } from 'react';
import { Button } from 'react-aria-components';

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
        description: `There was an error communicating with the AI service. Please try again. ${error}`,
      });
    }
  }, [pullRemoteFileFetcher.data, pullRemoteFileFetcher.state, item.doc.name]);

  return (
    <div className={`${ROW_CLASS} group`} style={{ paddingLeft: '2em' }}>
      <span className={ACTIVE_BORDER_CLASS} />
      <span className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm)`} style={{ left: '1.5em' }} />
      <Button className={TOGGLE_BTN_CLASS} aria-label="" isDisabled />
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
      >
        <Icon icon={isPulling ? 'spinner' : 'cloud-download'} className={ICON_CLASS} spin={isPulling} />
        <span>{item.doc.name}</span>
      </Button>
    </div>
  );
};
