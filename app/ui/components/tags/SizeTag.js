import React, {PropTypes} from 'react';
import classnames from 'classnames';
import * as misc from '../../../common/misc';

const SizeTag = ({bytes, small, className}) => {
  const responseSizeString = misc.describeByteSize(bytes);

  return (
    <div className={classnames('tag', {'tag--small': small}, className)}
         title={`${bytes} bytes`}>
      <strong>SIZE</strong>&nbsp;{responseSizeString}
    </div>
  );
};

SizeTag.propTypes = {
  // Required
  bytes: PropTypes.number.isRequired,

  // Optional
  small: PropTypes.bool,
};

export default SizeTag;
