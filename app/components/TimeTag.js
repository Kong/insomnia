import React, {PropTypes} from 'react'

const TimeTag = ({milliseconds}) => (
  <div className="tag">
    <strong>TIME</strong>&nbsp;{milliseconds} ms
  </div>
);

TimeTag.propTypes = {
  milliseconds: PropTypes.number.isRequired
};

export default TimeTag;
