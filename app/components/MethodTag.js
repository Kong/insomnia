import React, {Component, PropTypes} from 'react'
import * as constants from '../constants/global';

class MethodTag extends Component {
  render () {
    const {method} = this.props;

    let methodName;
    if (method === constants.METHOD_DELETE || method === constants.METHOD_OPTIONS) {
      methodName = method.slice(0, 3);
    } else if (method === constants.METHOD_PATCH) {
      methodName = 'PTCH';
    } else {
      methodName = method.slice(0, 4);
    }

    return (
      <div className={'tag tag--no-border tag--small method-' + method}>
        {methodName}
      </div>
    );
  }
}

MethodTag.propTypes = {
  method: PropTypes.string.isRequired
};

export default MethodTag;
