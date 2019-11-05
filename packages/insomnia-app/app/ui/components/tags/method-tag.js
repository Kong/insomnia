import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { HTTP_METHODS } from '../../../common/constants';
import * as util from '../../../common/misc';

class MethodTag extends PureComponent {
  render() {
    const { method, override, fullNames } = this.props;
    let methodName = method;
    let overrideName = override;

    if (!HTTP_METHODS.includes(override)) overrideName = null;
    if (!fullNames) {
      methodName = util.formatMethodName(method);
      if (overrideName) overrideName = util.formatMethodName(override);
    }

    return (
      <div style={{ position: 'relative' }}>
        {overrideName && (
          <div className={'tag tag--no-bg tag--superscript http-method-' + method}>
            <span>{methodName}</span>
          </div>
        )}
        <div
          className={'tag tag--no-bg tag--small http-method-' + (overrideName ? override : method)}>
          <span className="tag__inner">{overrideName || methodName}</span>
        </div>
      </div>
    );
  }
}

MethodTag.propTypes = {
  method: PropTypes.string.isRequired,

  // Optional
  override: PropTypes.string,
  fullNames: PropTypes.bool,
};

export default MethodTag;
