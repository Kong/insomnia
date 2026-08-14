import { type FC, useMemo } from 'react';

import { computeVisualDiff } from './diff-engine';
import { EnvironmentDiffCard } from './environment-diff-card';
import { GenericEntityDiffCard } from './generic-entity-diff-card';
import { RequestDiffCard } from './request-diff-card';

interface Props {
  before: string;
  after: string;
}

export const EntityDiffList: FC<Props> = ({ before, after }) => {
  const { entities, unparseable } = useMemo(() => computeVisualDiff(before, after), [before, after]);

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
        switch (diff.type) {
          case 'request': {
            return <RequestDiffCard key={diff.id} diff={diff} />;
          }
          case 'environment': {
            return <EnvironmentDiffCard key={diff.id} diff={diff} />;
          }
          default: {
            return <GenericEntityDiffCard key={diff.id} diff={diff} />;
          }
        }
      })}
    </div>
  );
};
