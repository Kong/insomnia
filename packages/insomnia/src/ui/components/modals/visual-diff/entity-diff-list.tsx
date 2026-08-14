import { type FC, useCallback, useMemo, useState } from 'react';

import { useGitProjectStagePartialContentActionFetcher } from '~/routes/git.stage-entity';

import { computeVisualDiff } from './diff-engine';
import { applyEntityChange } from './entity-splice';
import { EnvironmentDiffCard } from './environment-diff-card';
import { GenericEntityDiffCard } from './generic-entity-diff-card';
import { RequestDiffCard } from './request-diff-card';

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
  onEntityStaged?: () => void;
}

export const EntityDiffList: FC<Props> = ({ before, after, projectId, workspaceId, filepath, staged, onEntityStaged }) => {
  const { entities, unparseable } = useMemo(() => computeVisualDiff(before, after), [before, after]);
  const stagePartialContentFetcher = useGitProjectStagePartialContentActionFetcher();
  const [pendingEntityId, setPendingEntityId] = useState<string | null>(null);

  const handleStage = useCallback(async (entityId: string) => {
    setPendingEntityId(entityId);
    try {
      // Unstaged view: graft the entity's workdir state onto the current index.
      // Staged view: graft the entity's HEAD state back onto the index (ie. unstage it).
      const content = staged ? applyEntityChange(after, before, entityId) : applyEntityChange(before, after, entityId);
      await stagePartialContentFetcher.submit({
        filepath,
        content,
        projectId,
        workspaceId,
      });
      onEntityStaged?.();
    } finally {
      setPendingEntityId(null);
    }
  }, [staged, before, after, filepath, projectId, workspaceId, stagePartialContentFetcher, onEntityStaged]);

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

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
      {entities.map(diff => {
        const actionProps = {
          staged,
          isPending: pendingEntityId === diff.id,
          onStage: () => handleStage(diff.id),
        };

        switch (diff.type) {
          case 'request': {
            return <RequestDiffCard key={diff.id} diff={diff} {...actionProps} />;
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
  );
};
