import { format } from 'date-fns';
import React, { type FC } from 'react';
import {
  Cell,
  Column,
  ColumnResizer,
  ResizableTableContainer,
  Row,
  Table,
  TableBody,
  TableHeader,
  TooltipTrigger,
} from 'react-aria-components';

import type { RunnerTestResult } from '../../..//models/runner-test-result';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { getTimeAndUnit } from '../tags/time-tag';
import { Tooltip } from '../tooltip';

interface Props {
  history: RunnerTestResult[];
  gotoExecutionResult: (exectionId: string) => Promise<void>;
  gotoTestResultsTab: () => void;
  deleteHistoryItem: (item: RunnerTestResult) => void;
}

export const RunnerResultHistoryPane: FC<Props> = ({
  history,
  gotoExecutionResult,
  gotoTestResultsTab,
  deleteHistoryItem,
}) => {
  const rows = history.map((runnerResult: RunnerTestResult) => {
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const iteration of runnerResult.iterationResults) {
      for (const requests of iteration) {
        for (const testCase of requests.results) {
          if (testCase.status === 'failed') {
            failedCount++;
          }
          if (testCase.status === 'skipped') {
            skippedCount++;
          }
          if (testCase.status === 'passed') {
            passedCount++;
          }
        }
      }
    }

    const { number: durationNumber, unit: durationUnit } = getTimeAndUnit(runnerResult.duration);
    const createdAt = format(runnerResult.created, 'yyyy-MM-dd HH:mm:ss');

    return (
      <Row key={runnerResult._id} className="leading-9 hover:bg-(--hl-sm)" style={{ outline: 'none' }}>
        <Cell className="capitalize hover:underline">
          <div
            onClick={() => {
              gotoExecutionResult(runnerResult._id);
              gotoTestResultsTab();
            }}
            className="cursor-pointer"
          >
            {failedCount === 0 ? (
              <i className="fa fa-circle-check fa-1x mr-2 text-green-500" />
            ) : (
              <i className="fa fa-circle-xmark fa-1x mr-2 text-red-500" />
            )}
            <TooltipTrigger key={`parent-folder-${runnerResult.created}`}>
              <Tooltip message={createdAt}>{runnerResult.source}</Tooltip>
            </TooltipTrigger>
          </div>
        </Cell>
        <Cell>{runnerResult.iterations}</Cell>
        <Cell>{`${durationNumber} ${durationUnit}`}</Cell>
        {/* <Cell>{`${runnerResult.avgRespTime} ms`}</Cell> */}
        <Cell>{passedCount + failedCount + skippedCount}</Cell>
        <Cell>{passedCount}</Cell>
        <Cell>{failedCount}</Cell>
        <Cell>{skippedCount}</Cell>
        <Cell>
          <PromptButton
            disabled={false}
            confirmMessage=""
            doneMessage=""
            onClick={() => deleteHistoryItem(runnerResult)}
          >
            <Icon icon="trash-can" />
          </PromptButton>
        </Cell>
      </Row>
    );
  });

  return (
    <>
      <div className="mb-12 flex h-full flex-col divide-y divide-solid divide-(--hl-md) overflow-y-auto">
        <ResizableTableContainer className="mt-3">
          <Table aria-label="Results" selectionMode="multiple" className="w-full text-center">
            <TableHeader>
              {/* <Column className="leading-9" isRowHeader>Start Time</Column> */}
              <Column className="leading-9" isRowHeader>
                Source
                <ColumnResizer />
              </Column>
              <Column className="leading-9">
                Iterations
                <ColumnResizer />
              </Column>
              <Column className="leading-9">Duration</Column>
              {/* <Column className="leading-9">Avg. Resp. Time</Column> */}
              <Column className="leading-9">Total</Column>
              <Column className="leading-9">Passed</Column>
              <Column className="leading-9">Failed</Column>
              <Column className="leading-9">Skipped</Column>
              <Column className="leading-9">Delete</Column>
            </TableHeader>
            <TableBody>{rows}</TableBody>
          </Table>
        </ResizableTableContainer>
      </div>
    </>
  );
};
