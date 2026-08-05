import React, { type FC } from 'react';
import { Button } from 'react-aria-components';

import { isFinished, type RunnerLiveItem } from '../../../common/runner-feedback';
import { RequestResultCard } from './request-result-card';

interface Props {
  items: RunnerLiveItem[];
  isRunning: boolean;
  handleCancel: () => void;
  handleSkip: (key: string) => void;
}

export const RunnerLiveProgressPane: FC<Props> = ({ items, isRunning, handleCancel, handleSkip }) => {
  const total = items.length;
  const finished = items.filter(item => isFinished(item.status)).length;
  const skipped = items.filter(item => item.status === 'skipped').length;
  const canceled = items.filter(item => item.status === 'canceled').length;
  const iterations = [...new Set(items.map(item => item.iteration))];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-solid border-(--hl-md) bg-(--color-bg) px-3 py-2">
        <span className="text-sm">{`${isRunning ? 'Running' : 'Finished'} ${finished - skipped - canceled} / ${total} requests (${skipped} skipped, ${canceled} canceled)`}</span>
        {isRunning && (
          <Button
            className="rounded-xs border border-solid border-(--hl-md) px-3 py-0.5 text-sm hover:bg-(--hl-xs)"
            onPress={handleCancel}
          >
            Cancel all
          </Button>
        )}
      </div>
      {iterations.map(iteration => (
        <div key={`live-iteration-${iteration}`}>
          <div className="mb-1 pl-3 leading-10 font-bold uppercase">{`Iteration ${iteration}`}</div>
          {items
            .filter(item => item.iteration === iteration)
            .map(item => (
              <RequestResultCard
                key={`${item.key}-${isRunning}`}
                item={item}
                testId={`runner-live-item-${item.requestName}`}
                onSkip={() => handleSkip(item.key)}
                defaultExpanded={!isRunning}
              />
            ))}
        </div>
      ))}
    </div>
  );
};
