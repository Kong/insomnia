import React, { type DOMAttributes, type FunctionComponent, useEffect, useState } from 'react';

import type { TimingStep } from '../../main/network/request-timing';

interface Props {
  handleCancel: DOMAttributes<HTMLButtonElement>['onClick'];
  activeRequestId: string;
  steps: TimingStep[];
}
// triggers a 100 ms render in order to show a incrementing counter
const MillisecondTimer = ({ startedAt }: { startedAt: number }) => {
  const [milliseconds, setMilliseconds] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const loadStartTime = startedAt || Date.now();
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
  }, [startedAt]);
  const ms = milliseconds / 1000;
  return ms > 0 ? `${ms.toFixed(1)} s` : '0 s';
};

export const ResponseTimer: FunctionComponent<Props> = ({ handleCancel, activeRequestId, steps }) => {
  return (
    <div className="overlay theme--transparent-overlay-darker flex h-full w-full">
      <div className="m-auto w-[60%] min-w-[400px]">
        <div className="timer-list mx-auto">
          {steps.map((record: TimingStep) => (
            <div key={`${activeRequestId}-${record.stepName}`} className="flex w-full leading-8">
              <div className="text-md ml-1 w-3/4 content-center text-left leading-8">
                <span className="w-1/5 leading-8">
                  {record.duration !== undefined ? (
                    <i className="fa fa-circle-check fa-1x mr-2 text-green-500" />
                  ) : (
                    <i className="fa fa-spinner fa-spin fa-1x mr-2" />
                  )}
                </span>
                <span className="inline-block w-4/5 text-clip align-top">{record.stepName}</span>
              </div>
              <div className="mr-1 w-1/4 text-right leading-8">
                {record.duration !== undefined ? (
                  `${(record.duration / 1000).toFixed(1)} s`
                ) : (
                  <MillisecondTimer startedAt={record.startedAt} />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pad text-center">
          <button className="btn btn--clicky" onClick={handleCancel}>
            Cancel Request
          </button>
        </div>
      </div>
    </div>
  );
};
