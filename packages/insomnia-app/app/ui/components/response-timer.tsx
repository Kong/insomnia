import React, { DOMAttributes, FunctionComponent, useEffect, useState } from 'react';
import { REQUEST_SETUP_TEARDOWN_COMPENSATION, REQUEST_TIME_TO_SHOW_COUNTER } from '../../common/constants';

interface Props {
  handleCancel: DOMAttributes<HTMLButtonElement>['onClick'];
  loadStartTime: number;
}

export const ResponseTimer: FunctionComponent<Props> = ({ handleCancel, loadStartTime }) => {
  const [milliseconds, setMilliseconds] = useState(0);
  const isLoading = loadStartTime > 0;

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isLoading) {
      interval = setInterval(() => {
        setMilliseconds(Date.now() - loadStartTime - REQUEST_SETUP_TEARDOWN_COMPENSATION);
      }, 100);
    }
    return () => {
      if (interval !== null) {
        setMilliseconds(0);
        clearInterval(interval);
      }
    };
  }, [loadStartTime, isLoading]);

  if (!isLoading) {
    return null;
  }

  const seconds = milliseconds / 1000;
  return (
    <div className="overlay theme--transparent-overlay">
      <h2 style={{ fontVariantNumeric: 'tabular-nums' }}>
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
