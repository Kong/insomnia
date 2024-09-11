import React, { type FC, useState } from 'react';
import { Toolbar } from 'react-aria-components';

import type { BaseRunnerTestResult, RunnerResultPerRequest } from '../../../models/runner-test-result';
import { RequestTestResultRows } from './request-test-result-pane';

type TargetTestType = 'all' | 'passed' | 'failed' | 'skipped';

const filterClassnames = 'mx-1 w-[6rem] text-center rounded-md h-[--line-height-xxs] text-sm cursor-pointer outline-none select-none px-2 py-1 hover:bg-[rgba(var(--color-surprise-rgb),50%)] text-[--hl] aria-selected:text-[--color-font-surprise] hover:text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] transition-colors duration-300';
const activeFilterClassnames = 'text-white mx-1 w-[6rem] text-center rounded-md h-[--line-height-xxs] text-sm cursor-pointer outline-none select-none px-2 py-1 bg-[rgba(var(--color-surprise-rgb),50%)] text-[--hl] aria-selected:text-[--color-font-surprise] text-[--color-font-surprise] aria-selected:bg-[rgba(var(--color-surprise-rgb),40%)] transition-colors duration-300';

interface Props {
  result: BaseRunnerTestResult | null;
}

export const RunnerTestResultPane: FC<Props> = ({
  result,
}) => {
  const [targetTests, setTargetTests] = useState<TargetTestType>('all');
  const [resultFilter, setResultFilter] = useState('');

  const noTestFoundPage = (
    <div className="text-center mt-5">
      <div className="">No test result found</div>
      <div className="text-sm text-neutral-400">
        Add test cases in scripts and run them to see results.
      </div>
    </div>
  );
  if (!result || result.iterationResults.length === 0) {
    return noTestFoundPage;
  }

  const selectAllTests = () => setTargetTests('all');
  const selectPassedTests = () => setTargetTests('passed');
  const selectFailedTests = () => setTargetTests('failed');
  const selectSkippedTests = () => setTargetTests('skipped');

  const resultsByIteration = result.iterationResults.map((iterationResults: RunnerResultPerRequest[], i: number) => {
    const key = `runner-test-result-iteration-${i + 1}`;

    if (Array.isArray(iterationResults)) {
      const resultByRequest = iterationResults.map((requestTestResult: RunnerResultPerRequest, i: number) => {
        const key = `request-test-result-${i}`;
        return <div key={key}>
          <div className="pl-3">
            <span>
              {requestTestResult.requestName}
            </span>
            <span className="text-sm text-neutral-400">
              {` - ${requestTestResult.requestUrl}`}
            </span>
          </div>
          <RequestTestResultRows
            requestTestResults={requestTestResult.results}
            resultFilter={resultFilter}
            targetTests={targetTests}
          />
        </div>;
      });

      return <div key={key} data-testid={key} className="pt-6 pb-6 border-dashed border-b border-b-[--hl-md]">
        <div className="uppercase font-bold pl-3 mb-3 leading-10"> Iteration {i + 1} </div>
        <div className='border-solid border-1 border-gray-600' />
        {resultByRequest}
      </div>;
    } else {
      return <div key={key}>Invalid test result format</div>;
    }
  });

  return <>
    <div className='h-full flex flex-col divide-y divide-solid divide-[--hl-md]'>
      <div className='h-[calc(100%-var(--line-height-sm))]'>
        <Toolbar className="flex items-center h-[--line-height-sm] flex-row text-[var(--font-size-sm)] box-border overflow-x-auto border-solid border-b border-b-[--hl-md] pl-2">
          <button className={targetTests === 'all' ? activeFilterClassnames : filterClassnames} onClick={selectAllTests} >All</button>
          <button className={targetTests === 'passed' ? activeFilterClassnames : filterClassnames} onClick={selectPassedTests} >Passed</button>
          <button className={targetTests === 'failed' ? activeFilterClassnames : filterClassnames} onClick={selectFailedTests} >Failed</button>
          <button className={targetTests === 'skipped' ? activeFilterClassnames : filterClassnames} onClick={selectSkippedTests} >Skipped</button>
        </Toolbar>
        <div className="overflow-y-auto w-auto overflow-x-auto h-[calc(100%-var(--line-height-sm))]">
          {resultsByIteration}
        </div>
      </div>
      <Toolbar className="flex items-center h-[--line-height-sm] flex-shrink-0 flex-row text-[var(--font-size-sm)] box-border overflow-x-auto">
        <input
          key="test-results-filter"
          type="text"
          className='flex-1 pl-3'
          title="Filter test results"
          defaultValue={resultFilter || ''}
          placeholder='Filter test results with name'
          onChange={e => {
            setResultFilter(e.target.value);
          }}
        />
      </Toolbar>
    </div>
  </>;
};
