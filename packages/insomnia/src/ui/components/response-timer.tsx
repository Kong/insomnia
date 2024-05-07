import React, { DOMAttributes, FunctionComponent, useEffect, useState } from 'react';

import { REQUEST_SETUP_TEARDOWN_COMPENSATION } from '../../common/constants';
import { TimingRecord, watchRequestTiming } from '../../network/request-timing';
import { invariant } from '../../utils/invariant';

interface Props {
  handleCancel: DOMAttributes<HTMLButtonElement>['onClick'];
  activeRequestId?: string;
}

export const ResponseTimer: FunctionComponent<Props> = ({ handleCancel, activeRequestId }) => {
  const [milliseconds, setMilliseconds] = useState(0);
  const [timingCount, setTimingCount] = useState(0);
  const [timingRecords, setTimingRecords] = useState(new Array<TimingRecord>());

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const loadStartTime = Date.now();

    interval = setInterval(() => {
      setMilliseconds(Date.now() - loadStartTime - REQUEST_SETUP_TEARDOWN_COMPENSATION);
    }, 100);
    return () => {
      if (interval !== null) {
        setMilliseconds(0);
        clearInterval(interval);
      }
    };
  }, []);

  const executionId = activeRequestId;

  useEffect(() => {
    invariant(executionId, 'activeRequestId is undefined');

    const cb = (records: TimingRecord[]) => {
      if (records && records.length !== timingCount) {
        setMilliseconds(0);
        setTimingCount(records.length);
      }
      setTimingRecords(records);
    };

    watchRequestTiming(executionId, cb);
  });

  const seconds = milliseconds / 1000;

  const timingList = timingRecords.map((record: TimingRecord) => {
    const timingToDisplay = record.isDone ?
      ((record.endedAt - record.startedAt) / 1000) : seconds;

    return (
      <div
        key={`${executionId}-${record.stepName}`}
        className='flex w-full leading-10'
      >
        <div className='w-3/4 text-left content-center'>
          {
            record.isDone ?
              (<i className="fa fa-circle-check fa-2x mr-2 text-green-500" />) :
              (<i className="fa fa-spinner fa-spin fa-2x mr-3" />)
          }
          <span>{record.stepName}</span>
      </div>
        <div className='w-1/4 text-right' style={{ fontVariantNumeric: 'tabular-nums' }}>
          {timingToDisplay > 0 ? `${timingToDisplay.toFixed(2)}s` : '0s'}
      </div>
      </div>
    );
  });

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
