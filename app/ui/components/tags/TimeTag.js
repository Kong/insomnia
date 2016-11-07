import React, {PropTypes} from 'react';

const TimeTag = ({milliseconds}) => {
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

  return (
    <div className="tag">
      <strong>TIME</strong> {number} {unit}
    </div>
  )
}

TimeTag.propTypes = {
  milliseconds: PropTypes.number.isRequired
};

export default TimeTag;
