import crypto from 'crypto';
import type { RequestTestResult } from 'insomnia-sdk';
import React, { type FC, useState } from 'react';
import { Toolbar } from 'react-aria-components';

import { fuzzyMatch } from '../../../common/misc';

type TargetTestType = 'all' | 'passed' | 'failed' | 'skipped';

interface RequestTestResultRowsProps {
  requestTestResults: RequestTestResult[];
  resultFilter: string;
  targetTests: string;
}

const RequestTestResultRows: FC<RequestTestResultRowsProps> = ({
  requestTestResults,
  resultFilter,
  targetTests,
}: RequestTestResultRowsProps) => {
  const testResultRows = requestTestResults
    .filter(result => {
      switch (targetTests) {
        case 'all':
          return true;
        case 'passed':
          return result.status === 'passed';
        case 'failed':
          return result.status === 'failed';
        case 'skipped':
          return result.status === 'skipped';
        default:
          throw Error(`unexpected target test type ${targetTests}`);
      }
    })
    .filter(result => {
      if (resultFilter.trim() === '') {
        return true;
      }

      return Boolean(fuzzyMatch(
        resultFilter,
        result.testCase,
        { splitSpace: false, loose: true }
      )?.indexes);
    })
    .map((result, i: number) => {
      const key = crypto
        .createHash('sha1')
        .update(`${result.testCase}"-${i}`)
        .digest('hex');

      const statusText = {
        passed: 'PASS',
        failed: 'FAIL',
        skipped: 'SKIP',
      }[result.status];
      const statusTagColor = {
        passed: 'bg-lime-600',
        failed: 'bg-red-600',
        skipped: 'bg-slate-600',
      }[result.status];

      const executionTime = <span className={result.executionTime < 300 ? 'text-white-500' : 'text-red-500'} >
        {result.executionTime === 0 ? '< 0.1' : `${result.executionTime.toFixed(1)}`}
      </span>;
      const statusTag = <div className={`text-xs rounded p-[2px] inline-block w-16 text-center font-semibold ${statusTagColor}`}>
        {statusText}
      </div >;
      const message = <>
        <span className='capitalize'>{result.testCase}</span>
        <span className='text-neutral-400'>{result.errorMessage ? ' | ' + result.errorMessage : ''}</span>
      </>;
      const testCategory = result.category === 'pre-request' ? 'Pre-request Test' :
        result.category === 'after-response' ? 'After-response Test' : 'Unknown';

      return (
        <div key={key} data-testid="test-result-row">
          <div className="flex w-full my-3 text-base">
            <div className="leading-4 m-auto mx-1">
              <span className="mr-2 ml-2" >{statusTag}</span>
            </div>
            <div className="leading-4 mr-2">
              <div className='mr-2 my-1 w-auto text-nowrap'>{message}</div>
              <div className='text-sm text-neutral-400 my-1'>{`${testCategory} (`}{executionTime}{' ms)'}</div>
            </div>
          </div>
        </div>);
    });

  return <>{testResultRows}</>;
};

interface Props {
  requestTestResults: RequestTestResult[];
}

export const RequestTestResultPane: FC<Props> = ({
  requestTestResults,
}) => {
  const [targetTests, setTargetTests] = useState<TargetTestType>('all');
  const [resultFilter, setResultFilter] = useState('');

  const noTestFoundPage = (
    <div className="text-center mt-5">
      <div className="">No test results found</div>
      <div className="text-sm text-neutral-400">
        <b>
          <a href="https://docs.insomnia.rest/insomnia/after-response-script">
            Add test cases
          </a>
        </b> using scripting and run the request.
      </div>
    </div>
  );
  if (requestTestResults.length === 0) {
    return noTestFoundPage;
  }

  const selectAllTests = () => setTargetTests('all');
  const selectPassedTests = () => setTargetTests('passed');
  const selectFailedTests = () => setTargetTests('failed');
  const selectSkippedTests = () => setTargetTests('skipped');

  return <>
    <div className='h-full flex flex-col divide-y divide-solid divide-[--hl-md]'>
      <div className='h-[calc(100%-var(--line-height-sm))]'>
        <Toolbar className="flex items-center h-[--line-height-sm] flex-row text-[var(--font-size-sm)] box-border overflow-x-auto border-solid border-b border-b-[--hl-md]">
          <button className="rounded-3xl btn btn--clicky-small mx-1 my-auto" onClick={selectAllTests} >All</button>
          <button className="rounded-3xl btn btn--clicky-small mx-1 my-auto" onClick={selectPassedTests} >Passed</button>
          <button className="rounded-3xl btn btn--clicky-small mx-1 my-auto" onClick={selectFailedTests} >Failed</button>
          <button className="rounded-3xl btn btn--clicky-small mx-1 my-auto" onClick={selectSkippedTests} >Skipped</button>
        </Toolbar>
        <div className="overflow-y-auto w-auto overflow-x-auto h-[calc(100%-var(--line-height-sm))]">
          <RequestTestResultRows
            requestTestResults={requestTestResults}
            resultFilter={resultFilter}
            targetTests={targetTests}
          />
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
