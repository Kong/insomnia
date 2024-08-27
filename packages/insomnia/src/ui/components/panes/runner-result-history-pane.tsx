import { format } from 'date-fns';
import React, { type FC } from 'react';
import { Cell, Column, ColumnResizer, ResizableTableContainer, Row, Table, TableBody, TableHeader, TooltipTrigger } from 'react-aria-components';

import type { RunnerTestResult } from '../../..//models/runner-test-result';
import { getTimeAndUnit } from '../tags/time-tag';
import { Tooltip } from '../tooltip';

interface Props {
  history: RunnerTestResult[];
  gotoExecutionResult: (exectionId: string) => Promise<void>;
  gotoTestResultsTab: () => void;
}

export const RunnerResultHistoryPane: FC<Props> = ({
  history,
  gotoExecutionResult,
  gotoTestResultsTab,
}) => {
  const rows = history.map((runnerResult: RunnerTestResult) => {
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < runnerResult.iterationResults.length; i++) { // iterations
      for (let j = 0; j < runnerResult.iterationResults[i].length; j++) { // requests
        for (let k = 0; k < runnerResult.iterationResults[i][j].results.length; k++) { // test cases
          const result = runnerResult.iterationResults[i][j].results[k];

          if (result.status === 'failed') {
            failedCount++;
          }
          if (result.status === 'skipped') {
            skippedCount++;
          }
          if (result.status === 'passed') {
            passedCount++;
          }
        }
      }
    }

    // const startedAt = new Date(runnerResult.created).toString(); // TODO: should be endedat
    const { number: durationNumber, unit: durationUnit } = getTimeAndUnit(runnerResult.duration);
    const createdAt = format(runnerResult.created, 'yyyy-MM-dd HH:MM:ss');

    return (
      <Row
        key={runnerResult._id}
        className="cursor-pointer leading-9 hover:bg-neutral-900"
        style={{ 'outline': 'none' }}
        onAction={() => {
          gotoExecutionResult(runnerResult._id);
          gotoTestResultsTab();
        }}
      >
        <Cell className="capitalize hover:underline">
          {failedCount === 0 ?
            <i className="fa fa-circle-check fa-1x mr-2 text-green-500" /> :
            <i className="fa fa-circle-xmark fa-1x mr-2 text-red-500" />}
          <TooltipTrigger key={`parent-folder-${runnerResult.created}`} >
            <Tooltip message={createdAt}>
              {runnerResult.source}
            </Tooltip>
          </TooltipTrigger>
        </Cell>
        <Cell>{runnerResult.iterations}</Cell>
        <Cell>{`${durationNumber} ${durationUnit}`}</Cell>
        {/* <Cell>{`${runnerResult.avgRespTime} ms`}</Cell> */}
        <Cell>{passedCount + failedCount + skippedCount}</Cell>
        <Cell>{passedCount}</Cell>
        <Cell>{failedCount}</Cell>
        <Cell>{skippedCount}</Cell>
      </Row>
    );
  });

  return <>
    <div className='h-full flex flex-col divide-y divide-solid divide-[--hl-md] overflow-y-auto mb-12'>
      <ResizableTableContainer className='mt-3'>
        <Table aria-label="Results" selectionMode="multiple" className="w-full text-center">
          <TableHeader>
            {/* <Column className="leading-9" isRowHeader>Start Time</Column> */}
            <Column className="leading-9" isRowHeader>Source<ColumnResizer /></Column>
            <Column className="leading-9">Iterations<ColumnResizer /></Column>
            <Column className="leading-9">Duration</Column>
            {/* <Column className="leading-9">Avg. Resp. Time</Column> */}
            <Column className="leading-9">Total</Column>
            <Column className="leading-9">Passed</Column>
            <Column className="leading-9">Failed</Column>
            <Column className="leading-9">Skipped</Column>
          </TableHeader>
          <TableBody >
            {rows}
          </TableBody>
        </Table>
      </ResizableTableContainer>
    </div>
  </>;
};
