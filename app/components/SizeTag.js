import React, {PropTypes} from 'react'

const SizeTag = props => {
  const bytes = Math.round(props.bytes * 10) / 10;
  let size;

  let unit = 'B';
  if (bytes < 1024) {
    size = bytes;
    unit = 'B';
  } else if (bytes < 1024 * 1024) {
    size = bytes / 1024;
    unit = 'KB';
  } else if (bytes < 1024 * 1024) {
    size = bytes / 1024 / 1024;
    unit = 'MB';
  } else {
    size = bytes / 1024 / 1024 / 1024;
    unit = 'GB';
  }

  const responseSizeString = Math.round(size * 10) / 10 + ' ' + unit;

  return (
    <div className="tag">
      <strong>SIZE</strong>&nbsp;{responseSizeString}
    </div>
  );
};

SizeTag.propTypes = {
  bytes: PropTypes.number.isRequired
};

export default SizeTag;
