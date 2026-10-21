import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'react-aria-components';

import { useGitProjectDiscardPartialContentActionFetcher } from '~/routes/git.discard-entity';
import { useGitProjectStagePartialContentActionFetcher } from '~/routes/git.stage-entity';

import { showToast } from '../../toast-notification';
import { WarningBanner } from '../../warning-banner';
import type { ActionGate } from './action-gate';
import { CookieJarDiffCard } from './cookie-jar-diff-card';
import { computeVisualDiff, getBaseEnvironmentId } from './diff-engine';
import { applyEntityChange, hasOnlyWorkspaceIdentity } from './entity-splice';
import { EnvironmentDiffCard } from './environment-diff-card';
import { GenericEntityDiffCard } from './generic-entity-diff-card';
import { GrpcDiffCard } from './grpc-diff-card';
import { McpDiffCard } from './mcp-diff-card';
import { MockRouteDiffCard } from './mock-route-diff-card';
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
  // Switches the preview to the Text view, which shows exactly what git will commit.
  onShowTextView: () => void;
  // Shared with the file-level actions, so a card's action never overlaps one of them on the same file.
  actionGate: ActionGate;
  // Whether an action, here or file-level, is still in flight: every card's buttons wait for it.
  isActionInFlight: boolean;
  // Set when the diff already has a warning saying more than the format warning would (eg. unrecognized fields).
  hideFormatWarning?: boolean;
}

type FormatIssue = Awaited<ReturnType<typeof window.main.git.fileFormatIssueLoader>>;

// Shown instead of cards when there are none to show; the Text view still has the full diff.
const TextViewHint: FC<{ message: string; onShowTextView: () => void }> = ({ message, onShowTextView }) => (
  <div className="flex h-full flex-1 items-center justify-center p-4 text-center text-(--hl)">
    <span>
      {message}{' '}
      <Button onPress={onShowTextView} className="cursor-pointer text-(--color-font) underline hover:brightness-125">
        Open the Text view
      </Button>{' '}
      to see the raw diff.
    </span>
  </div>
);

export const EntityDiffList: FC<Props> = ({
  before,
  after,
  projectId,
  workspaceId,
  filepath,
  staged,
  onEntityChanged,
  onShowTextView,
  actionGate,
  isActionInFlight,
  hideFormatWarning,
}) => {
  const { entities, unparseable } = useMemo(() => computeVisualDiff(before, after), [before, after]);

  // Whether either side isn't a file as Insomnia writes it (eg. edited by hand): `invalid` doesn't match the
  // Insomnia file format at all, `non-canonical` does but Insomnia would write it differently. Checked in the
  // background, as it replays both sides through import -> export, so it doesn't hold up showing the diff.
  // Kept per file, so a refresh after an action doesn't flash the warning, and another file never shows it.
  const fileKey = `${filepath}:${staged}`;
  const [formatCheck, setFormatCheck] = useState<{ fileKey: string; issue: FormatIssue } | null>(null);
  useEffect(() => {
    let cancelled = false;
    window.main.git
      .fileFormatIssueLoader({ projectId, workspaceId, filepath, staged })
      .then(issue => {
        if (!cancelled) {
          setFormatCheck({ fileKey, issue });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceId, filepath, staged, fileKey, before, after]);
  const formatIssue = formatCheck?.fileKey === fileKey ? formatCheck.issue : null;

  const baseEnvironmentId = useMemo(() => getBaseEnvironmentId(after), [after]);
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

  // Every action computes from the diff on screen, so one clicked while another is in flight (even
  // before the re-render that disables the buttons) is skipped: that one is about to change the diff.
  const runAction = useCallback(
    async (entityId: string, action: NonNullable<EntityCardPendingAction>, perform: () => Promise<unknown>) => {
      await actionGate.tryRun(async () => {
        setPending({ entityId, action });
        try {
          await perform();
          await onEntityChanged?.();
        } finally {
          setPending(null);
        }
      });
    },
    [actionGate, onEntityChanged],
  );

  const handleStage = useCallback(
    (entityId: string) =>
      runAction(entityId, 'stage', () => {
        // Unstaged view: graft the entity's workdir state onto the current index.
        // Staged view: graft the entity's HEAD state back onto the index (ie. unstage it).
        const content = staged
          ? applyEntityChange(after, before, entityId)
          : applyEntityChange(before, after, entityId);
        // The side the index moves towards has no file (staging a deleted file, unstaging a new one). Once only the
        // workspace identity is left, which has no card to stage on its own, take the file out of the index (`null`)
        // rather than leave an empty file there.
        const target = staged ? before : after;
        return stagePartialContentFetcher.submit({
          filepath,
          content: !target && hasOnlyWorkspaceIdentity(content) ? null : content,
          projectId,
          workspaceId,
        });
      }),
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
    return <TextViewHint message="Unable to parse this file for a visual diff." onShowTextView={onShowTextView} />;
  }

  if (formatIssue === 'invalid') {
    return (
      <TextViewHint
        message="This file doesn't match the Insomnia file format, so the Visual view can't show it."
        onShowTextView={onShowTextView}
      />
    );
  }

  if (entities.length === 0) {
    // Also covers metadata-only (eg. timestamps) and formatting-only changes, and non-Insomnia files
    // such as the project's .spectral.yaml lint ruleset — not just moves.
    return (
      <TextViewHint
        message="No requests, folders, environments or settings changed — this file only has changes the Visual view doesn't show, like moves, reordering, timestamps or formatting."
        onShowTextView={onShowTextView}
      />
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
      {formatIssue === 'non-canonical' && !hideFormatWarning && (
        // Cards are matched up by id and actions splice entities into a file written the way Insomnia exports it,
        // so a file in any other shape (eg. edited by hand) can show incomplete cards and lose what isn't an entity.
        <WarningBanner className="shrink-0 text-sm" data-testid="visual-diff-format-warning">
          This file isn&apos;t in the format Insomnia writes, eg. it was edited by hand or by another version. Cards may
          be incomplete, and staging or discarding a card rewrites the whole file, losing comments and formatting.{' '}
          <Button onPress={onShowTextView} className="cursor-pointer underline hover:brightness-125">
            Open the Text view
          </Button>{' '}
          for the exact changes.
        </WarningBanner>
      )}
      <div className="flex shrink-0 items-center gap-3 text-xs">
        <span className="font-semibold text-(--color-font)">
          {entities.length} {entities.length === 1 ? 'entity' : 'entities'} changed
        </span>
        {summary.added > 0 && <span className="text-(--color-success)">{summary.added} added</span>}
        {summary.modified > 0 && <span className="text-(--color-notice)">{summary.modified} modified</span>}
        {summary.removed > 0 && <span className="text-(--color-danger)">{summary.removed} removed</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {entities.map(diff => {
          // A file's identity (type/name/meta) can't be added or removed on its own: that's the whole
          // file appearing or disappearing, which the file-level actions handle (and staging a new
          // file's first entity carries its identity along anyway).
          const isFileIdentityChange = diff.type === 'workspace' && diff.status !== 'modified';
          // Insomnia recreates a workspace's base environment and cookie jar as soon as they're missing,
          // so discarding one that was just added (eg. in a new file) would be undone right away.
          const isRecreatedIfDiscarded =
            diff.status === 'added' && (diff.type === 'cookie_jar' || diff.id === baseEnvironmentId);
          const actionProps = {
            staged,
            pendingAction: pending?.entityId === diff.id ? pending.action : null,
            isDisabled: isActionInFlight,
            onStage: isFileIdentityChange ? undefined : () => handleStage(diff.id),
            // No per-entity discard when the working-tree file is gone (deleted
            // workspace): it would resurrect the file with just this one entity.
            // The file-level discard restores it whole.
            onDiscard:
              staged || !after || isFileIdentityChange || isRecreatedIfDiscarded
                ? undefined
                : () => handleDiscard(diff.id),
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
            case 'mcp_request': {
              return <McpDiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
            case 'mock_route': {
              return <MockRouteDiffCard key={diff.id} diff={diff} {...actionProps} />;
            }
            case 'cookie_jar': {
              return <CookieJarDiffCard key={diff.id} diff={diff} {...actionProps} />;
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
