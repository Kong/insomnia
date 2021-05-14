import React, { DOMAttributes, FunctionComponent, useEffect, useState } from 'react';
import { REQUEST_TIME_TO_SHOW_COUNTER } from '../../common/constants';

interface Props {
  handleCancel: DOMAttributes<HTMLButtonElement>['onClick'],
  loadStartTime: number,
}

export const ResponseTimer: FunctionComponent<Props> = ({ handleCancel, loadStartTime }) => {
  const [seconds, setSeconds] = useState(0);
  const isLoading = loadStartTime > 0;

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLoading) {
      interval = setInterval(() => {
        const milliseconds = Date.now() - loadStartTime - 200;
        setSeconds(milliseconds / 1000);
      }, 100);
    }
    return () => {
      setSeconds(0);
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [loadStartTime, setSeconds, isLoading]);

  if (!isLoading) {
    return null;
  }

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
