import type { RunnerResultPerRequest } from 'insomnia-data';
import React, { type FC, useState } from 'react';
import { Button } from 'react-aria-components';

import { Icon } from '~/ui/components/icon';

import {
  formatResponseStats,
  getRunnerStatusTag,
  type RunnerItemStatus,
  type RunnerLiveItem,
} from '../../../common/runner-feedback';
import { RenderedText } from '../rendered-text';
import { filterTestResults, RequestTestResultRows } from './request-test-result-pane';

interface Props {
  item: RunnerResultPerRequest | RunnerLiveItem;
  resultFilter?: string;
  targetTests?: string;
  onSkip?: () => void;
  testId?: string;
  defaultExpanded?: boolean;
}

export const RequestResultCard: FC<Props> = ({
  item,
  resultFilter = '',
  targetTests = 'all',
  onSkip,
  testId,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const status: RunnerItemStatus =
    'status' in item ? item.status : item.skipped ? 'skipped' : item.responseCode > 0 ? 'completed' : 'failed';
  const isSkipped = status === 'skipped';
  const statusCode = 'status' in item ? item.statusCode : item.responseCode;
  const statusMessage = 'status' in item ? item.statusMessage : item.responseMessage;
  const errorMessage = 'status' in item ? item.errorMessage : undefined;
  const tag = getRunnerStatusTag({ status, statusCode, statusMessage });
  const stats = formatResponseStats(item);
  const results = item.results ?? [];
  const passedTests = results.filter(result => result.status === 'passed').length;
  const showSkip = Boolean(onSkip) && (status === 'pending' || status === 'running');
  const showError = (status === 'failed' || status === 'canceled') && Boolean(errorMessage);
  const showExpand = status === 'completed' || status === 'failed';
  const showTestResults = isExpanded && !isSkipped && results.length > 0;
  const showInlineStats = isExpanded && !isSkipped && stats;

  const requestId = 'requestId' in item ? item.requestId : undefined;

  const isFilterEngaged = targetTests !== 'all' || resultFilter.trim() !== '';
  if (isFilterEngaged && filterTestResults(results, targetTests, resultFilter).length === 0) {
    return null;
  }

  return (
    <div data-testid={testId} className="m-3 rounded-sm border border-solid border-(--hl-md) p-3">
      <div className="flex items-start gap-2">
        <div
          className={`inline-block w-22 shrink-0 rounded-sm px-2 py-[2px] text-center text-xs font-semibold text-white ${tag.className}`}
        >
          {tag.label}
        </div>
        <div className="min-w-0 flex-1">
          <div>
            <span>{item.requestName}</span>
            <span className="text-sm text-neutral-400">
              {' - '}
              {item.requestUrl.includes('{{') ? (
                <RenderedText requestId={requestId}>{item.requestUrl}</RenderedText>
              ) : (
                item.requestUrl
              )}
            </span>
            {!isExpanded && !isSkipped && results.length > 0 && (
              <span className="ml-2 text-xs whitespace-nowrap text-neutral-400">
                {`(${passedTests}/${results.length} tests passed)`}
              </span>
            )}
          </div>
          {showInlineStats && <div className="text-sm text-neutral-400">{stats}</div>}
          {showError && <div className="text-sm text-red-500">{errorMessage}</div>}
        </div>
        {showSkip && (
          <Button
            className="shrink-0 rounded-xs border border-solid border-(--hl-md) px-3 py-0.5 text-sm hover:bg-(--hl-xs)"
            onPress={onSkip}
          >
            Skip
          </Button>
        )}
        {showExpand && (
          <Button
            onPress={() => setIsExpanded(prev => !prev)}
            className="shrink-0 rounded-xs px-3 pt-1 pb-0.5 text-sm hover:bg-(--hl-xs)"
          >
            {isExpanded ? <Icon icon="chevron-down" /> : <Icon icon="chevron-right" />}
          </Button>
        )}
      </div>
      {showTestResults && (
        <RequestTestResultRows requestTestResults={results} resultFilter={resultFilter} targetTests={targetTests} />
      )}
    </div>
  );
};
