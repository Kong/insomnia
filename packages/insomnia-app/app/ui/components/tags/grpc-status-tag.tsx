import React, { PureComponent } from 'react';
import classnames from 'classnames';
import Tooltip from '../tooltip';
import { GrpcStatusEnum } from '../../../network/grpc/service-error';

interface Props {
  statusCode: number;
  small?: boolean;
  statusMessage?: string;
  tooltipDelay?: number;
}

class GrpcStatusTag extends PureComponent<Props> {
  render() {
    const { statusMessage, statusCode, small, tooltipDelay } = this.props;
    const colorClass = statusCode === GrpcStatusEnum.OK ? 'bg-success' : 'bg-danger';
    const message = statusCode === GrpcStatusEnum.OK ? 'OK' : statusMessage;
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
