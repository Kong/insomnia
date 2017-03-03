import React, {PropTypes} from 'react';
import classnames from 'classnames';

const TimeTag = ({milliseconds, small, className}) => {
  let unit = 'ms';
  let number = milliseconds;

  if (milliseconds > 1000 * 60) {
    unit = 'm';
    number = milliseconds / 1000 / 60;
  } else if (milliseconds > 1000) {
    unit = 's';
    number = milliseconds / 1000;
  }

  // Round to 2 decimal places
  number = Math.round(number * 100) / 100;

  let description = `${milliseconds} milliseconds`;
  return (
    <div className={classnames('tag', {'tag--small': small}, className)} title={description}>
      <strong>TIME</strong> {number} {unit}
    </div>
  );
};

TimeTag.propTypes = {
  // Required
  milliseconds: PropTypes.number.isRequired,

  // Optional
  small: PropTypes.bool
};

export default TimeTag;
