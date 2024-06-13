import React, { DOMAttributes, FunctionComponent, useEffect, useState } from 'react';

import { TimingStep } from '../../network/request-timing';
import { useExecutionState } from '../hooks/use-execution-state';

interface Props {
  handleCancel: DOMAttributes<HTMLButtonElement>['onClick'];
  activeRequestId: string;
}
// triggers a 100 ms render in order to show a incrementing counter
const MillisecondTimer = () => {
  const [milliseconds, setMilliseconds] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const loadStartTime = Date.now();
    interval = setInterval(() => {
      const delta = Date.now() - loadStartTime;
      setMilliseconds(delta);
    }, 100);
    return () => {
      if (interval !== null) {
        setMilliseconds(0);
        clearInterval(interval);
      }
    };
  }, []);
  const ms = (milliseconds / 1000);
  return ms > 0 ? `${ms.toFixed(1)} s` : '0 s';
};
export const ResponseTimer: FunctionComponent<Props> = ({ handleCancel, activeRequestId }) => {
  const { steps, isExecuting } = useExecutionState({ requestId: activeRequestId });

  const timingList = isExecuting ? (steps || []).map((record: TimingStep) => {
    return (
      <div
        key={`${activeRequestId}-${record.stepName}`}
        className='flex w-full leading-8'
      >
        <div className='w-3/4 text-left content-center leading-8'>
          <span className="leading-8">
          {
              record.duration ?
              (<i className="fa fa-circle-check fa-2x mr-2 text-green-500" />) :
                (<i className="fa fa-spinner fa-spin fa-2x mr-2" />)
          }
          </span>
          <span className="inline-block align-top">
            {record.stepName}
          </span>
        </div>
        {record.duration ? `${((record.duration) / 1000).toFixed(1)} s` : (<MillisecondTimer />)}
      </div>
    );
  }) : [];

  return (
    <div className="overlay theme--transparent-overlay">
      <div className="timer-list w-full">
        {timingList}
      </div>

      <div className="pad">
        <button
          className="btn btn--clicky"
          onClick={handleCancel}
        >
          Cancel Request
        </button>
      </div>
    </div>
  );
};
