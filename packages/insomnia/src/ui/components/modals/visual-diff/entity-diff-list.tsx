import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useGitProjectDiscardPartialContentActionFetcher } from '~/routes/git.discard-entity';
import { useGitProjectStagePartialContentActionFetcher } from '~/routes/git.stage-entity';

import { showToast } from '../../toast-notification';
import { computeVisualDiff } from './diff-engine';
import { applyEntityChange } from './entity-splice';
import { EnvironmentDiffCard } from './environment-diff-card';
import { GenericEntityDiffCard } from './generic-entity-diff-card';
import { GrpcDiffCard } from './grpc-diff-card';
import { RequestDiffCard } from './request-diff-card';
import { RequestGroupDiffCard } from './request-group-diff-card';
import type { EntityCardPendingAction } from './shared';
import { SocketIODiffCard } from './socket-io-diff-card';
import { WebSocketDiffCard } from './websocket-diff-card';

interface Props {
  before: string;
  after: string;
  projectId: string;
  workspaceId?: string;
  filepath: string;
  // Whether this diff is HEAD..INDEX (staged, `before`=head/`after`=stage) or
  // INDEX..WORKDIR (unstaged, `before`=stage/`after`=workdir) — determines the
  // direction of "stage"/"unstage" and which side each entity's action pulls from.
  staged: boolean;
  // Called after any per-entity action (stage/unstage/discard) finishes, so the
  // parent can refresh the file list and this file's diff. Actions stay locked
  // until the returned promise settles, since the next one must compute from the
  // refreshed `before`/`after`.
  onEntityChanged?: () => Promise<unknown> | void;
}

export const EntityDiffList: FC<Props> = ({ before, after, projectId, workspaceId, filepath, staged, onEntityChanged }) => {
  const { entities, unparseable } = useMemo(() => computeVisualDiff(before, after), [before, after]);
  const stagePartialContentFetcher = useGitProjectStagePartialContentActionFetcher();
  const discardPartialContentFetcher = useGitProjectDiscardPartialContentActionFetcher();
  const [pending, setPending] = useState<{ entityId: string; action: NonNullable<EntityCardPendingAction> } | null>(null);

  const stageErrors = stagePartialContentFetcher.state === 'idle' ? stagePartialContentFetcher.data?.errors : undefined;
  useEffect(() => {
    if (stageErrors?.length) {
      showToast({
        status: 'error',
        title: staged ? 'Failed to unstage changes' : 'Failed to stage changes',
        description: stageErrors.join('\n'),
      });
    }
    // `staged` deliberately omitted: only a new action result should toast, not a view switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageErrors]);

  const discardErrors = discardPartialContentFetcher.state === 'idle' ? discardPartialContentFetcher.data?.errors : undefined;
  useEffect(() => {
    if (discardErrors?.length) {
      showToast({ status: 'error', title: 'Failed to discard changes', description: discardErrors.join('\n') });
    }
  }, [discardErrors]);

  // Synchronous guard on top of `pending`: two clicks landing before the re-render
  // that disables the buttons would otherwise both compute from the same diff.
  const isBusyRef = useRef(false);

  const runAction = useCallback(
    async (entityId: string, action: NonNullable<EntityCardPendingAction>, perform: () => Promise<unknown>) => {
      if (isBusyRef.current) {
        return;
      }
      isBusyRef.current = true;
      setPending({ entityId, action });
      try {
        await perform();
        await onEntityChanged?.();
      } finally {
        isBusyRef.current = false;
        setPending(null);
      }
    },
    [onEntityChanged],
  );

  const handleStage = useCallback(
    (entityId: string) =>
      runAction(entityId, 'stage', () =>
        stagePartialContentFetcher.submit({
          filepath,
          // Unstaged view: graft the entity's workdir state onto the current index.
          // Staged view: graft the entity's HEAD state back onto the index (ie. unstage it).
          content: staged ? applyEntityChange(after, before, entityId) : applyEntityChange(before, after, entityId),
          projectId,
          workspaceId,
        }),
      ),
    [runAction, staged, before, after, filepath, projectId, workspaceId, stagePartialContentFetcher],
  );

  // Unstaged view only: graft the entity's index/HEAD state (`before`) onto the
  // workdir file (`after`), throwing away just this entity's unstaged edits.
  const handleDiscard = useCallback(
    (entityId: string) =>
      runAction(entityId, 'discard', () =>
        discardPartialContentFetcher.submit({
          filepath,
          content: applyEntityChange(after, before, entityId),
          projectId,
          workspaceId,
        }),
      ),
    [runAction, before, after, filepath, projectId, workspaceId, discardPartialContentFetcher],
  );

  if (unparseable) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-4 text-center text-(--hl)">
        Unable to parse this file for a visual diff. Try the Text view instead.
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-4 text-center text-(--hl)">
        No structured changes detected in this file. Try the Text view to see the raw diff.
      </div>
    );
  }

  const summary = entities.reduce(
    (acc, entity) => {
      acc[entity.status] += 1;
      return acc;
    },
    { added: 0, removed: 0, modified: 0 },
  );

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 text-xs">
        <span className="font-semibold text-(--color-font)">
          {entities.length} {entities.length === 1 ? 'entity' : 'entities'} changed
        </span>
        {summary.added > 0 && <span className="text-(--color-font-success)">{summary.added} added</span>}
        {summary.modified > 0 && <span className="text-(--color-font-notice)">{summary.modified} modified</span>}
        {summary.removed > 0 && <span className="text-(--color-font-danger)">{summary.removed} removed</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {entities.map(diff => {
          const actionProps = {
            staged,
            pendingAction: pending?.entityId === diff.id ? pending.action : null,
            isDisabled: pending !== null,
            onStage: () => handleStage(diff.id),
            // No per-entity discard when the working-tree file is gone (deleted
            // workspace): it would resurrect the file with just this one entity.
            // The file-level discard restores it whole.
            onDiscard: staged || !after ? undefined : () => handleDiscard(diff.id),
          };

          switch (diff.type) {
            case 'request': {
              return <RequestDiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
            case 'request_group': {
              return <RequestGroupDiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
            case 'websocket_request': {
              return <WebSocketDiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
            case 'socketio_request': {
              return <SocketIODiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
            case 'grpc_request': {
              return <GrpcDiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
            case 'environment': {
              return <EnvironmentDiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
            default: {
              return <GenericEntityDiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
          }
        })}
      </div>
    </div>
  );
};
