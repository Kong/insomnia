import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import * as constants from '../../../common/constants';
import * as util from '../../../common/misc';

class MethodTag extends PureComponent {
  render() {
    const { method, fullNames } = this.props;
    let methodName = method;

    if (!fullNames) {
      if (
        method === constants.METHOD_DELETE ||
        method === constants.METHOD_OPTIONS
      ) {
        methodName = method.slice(0, 3);
      } else if (method.length > 4) {
        methodName = util.removeVowels(method).slice(0, 4);
      }
    }

    return (
      <div className={'tag tag--no-bg tag--small http-method-' + method}>
        <span className="tag__inner">{methodName}</span>
      </div>
    );
  }
}

MethodTag.propTypes = {
  method: PropTypes.string.isRequired,

  // Optional
  fullNames: PropTypes.bool
};

export default MethodTag;
