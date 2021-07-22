import React, { PureComponent } from 'react';

import * as util from '../../../common/misc';

interface Props {
  method: string;
  override?: string | null;
  fullNames?: boolean;
}

class MethodTag extends PureComponent<Props> {
  render() {
    const { method, override, fullNames } = this.props;
    let methodName = method;
    let overrideName = override;

    if (!fullNames) {
      methodName = util.formatMethodName(method);
      overrideName = override ? util.formatMethodName(override) : override;
    }

    return (
      <div
        style={{
          position: 'relative',
        }}>
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

export default MethodTag;
