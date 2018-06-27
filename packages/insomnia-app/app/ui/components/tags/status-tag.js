// @flow
import * as React from 'react';
import classnames from 'classnames';
import { RESPONSE_CODE_DESCRIPTIONS } from '../../../common/constants';
import Tooltip from '../tooltip';

type Props = {
  statusCode: number,

  // Optional
  small?: boolean,
  statusMessage?: string
};

class StatusTag extends React.PureComponent<Props> {
  render() {
    const { statusMessage, statusCode, small } = this.props;

    let colorClass;
    let statusCodeToDisplay = statusCode;

    const firstChar = (statusCode + '')[0] || '';
    switch (firstChar) {
      case '1':
        colorClass = 'bg-info';
        break;
      case '2':
        colorClass = 'bg-success';
        break;
      case '3':
        colorClass = 'bg-surprise';
        break;
      case '4':
        colorClass = 'bg-warning';
        break;
      case '5':
        colorClass = 'bg-danger';
        break;
      case '0':
        colorClass = 'bg-danger';
        statusCodeToDisplay = '';
        break;
      default:
        colorClass = 'bg-surprise';
        statusCodeToDisplay = '';
        break;
    }

    const description =
      RESPONSE_CODE_DESCRIPTIONS[statusCode] || 'Unknown Response Code';

    return (
      <div className={classnames('tag', colorClass, { 'tag--small': small })}>
        <Tooltip message={description} position="bottom">
          <strong>{statusCodeToDisplay}</strong> {statusMessage}
        </Tooltip>
      </div>
    );
  }
}

export default StatusTag;
