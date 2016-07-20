import React, {PropTypes} from 'react';
import * as constants from '../lib/constants';

const MethodTag = ({method, fullNames}) => {
  let methodName = method;

  if (!fullNames) {
    if (method === constants.METHOD_DELETE || method === constants.METHOD_OPTIONS) {
      methodName = method.slice(0, 3);
    } else if (method === constants.METHOD_PATCH) {
      methodName = 'PTCH';
    } else {
      methodName = method.slice(0, 4);
    }
  }

  return (
    <div className={'tag tag--no-bg tag--small method-' + method}>
      <span className='tag__inner'>{methodName}</span>
    </div>
  )
};

MethodTag.propTypes = {
  method: PropTypes.string.isRequired,

  // Optional
  fullNames: PropTypes.bool
};

export default MethodTag;
