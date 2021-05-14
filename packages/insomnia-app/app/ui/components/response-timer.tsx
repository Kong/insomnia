import React, { DOMAttributes, FunctionComponent, useEffect, useState } from 'react';
import { REQUEST_TIME_TO_SHOW_COUNTER } from '../../common/constants';

interface Props {
  handleCancel: DOMAttributes<HTMLButtonElement>['onClick'];
  loadStartTime: number;
  responseTime?: number;
}

export const ResponseTimer: FunctionComponent<Props> = ({ handleCancel, loadStartTime, responseTime = 0 }) => {
  const [milliseconds, setMilliseconds] = useState(0);
  const isLoading = loadStartTime > 0;

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLoading) {
      interval = setInterval(() => {
        const milliseconds = Date.now() - loadStartTime;
        setMilliseconds(milliseconds);
      }, 100);
    }
    return () => {
      if (interval !== null) {
        setMilliseconds(milliseconds => {
          if (milliseconds > 0) {
            console.info(`[ResponseTimer] lag measured to be ${Math.floor(milliseconds - responseTime)}ms`, {
              wallTime: milliseconds,
              responseTime,
            });
          }
          return 0;
        });
        clearInterval(interval);
      }
    };
  }, [loadStartTime, setMilliseconds, isLoading, responseTime]);

  if (!isLoading) {
    return null;
  }

  const seconds = milliseconds / 1000;
  return (
    <div className="overlay theme--transparent-overlay">
      <h2>
        {seconds >= REQUEST_TIME_TO_SHOW_COUNTER ? `${seconds.toFixed(1)} seconds` : 'Loading'}...
      </h2>
      <div className="pad">
        <i className="fa fa-refresh fa-spin" />
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
