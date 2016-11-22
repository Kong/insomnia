import React, {PropTypes} from 'react';
import * as misc from '../../../common/misc';

const SizeTag = props => {
  const responseSizeString = misc.describeByteSize(props.bytes);

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
