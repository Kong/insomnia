import { status } from '@grpc/grpc-js';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import Tooltip from '../tooltip';

interface Props {
  statusCode?: number;
  small?: boolean;
  statusMessage?: string;
  tooltipDelay?: number;
}

class GrpcStatusTag extends PureComponent<Props> {
  render() {
    const { statusMessage, statusCode, small, tooltipDelay } = this.props;
    const colorClass = statusCode === status.OK ? 'bg-success' : 'bg-danger';
    const message = statusCode === status.OK ? 'OK' : statusMessage;
    return (
      <div
        className={classnames('tag', colorClass, {
          'tag--small': small,
        })}>
        <Tooltip message={message} position="bottom" delay={tooltipDelay}>
          <strong>{statusCode} </strong>
          {message}
        </Tooltip>
      </div>
    );
  }
}

export default GrpcStatusTag;
