// @flow
import * as React from 'react';
import classnames from 'classnames';
import {RESPONSE_CODE_DESCRIPTIONS, RESPONSE_CODE_REASONS} from '../../../common/constants';
import Tooltip from '../tooltip';

type Props = {
  statusCode: number,

  // Optional
  small?: boolean,
  statusMessage?: string
};

class StatusTag extends React.PureComponent<Props> {
  render () {
    const {statusMessage, statusCode, small} = this.props;

    let colorClass;
    let genericStatusMessage;
    let statusCodeToDisplay = statusCode;

    const firstChar = (statusCode + '')[0] || '';
    switch (firstChar) {
      case '1':
        colorClass = 'bg-info';
        genericStatusMessage = 'INFORMATIONAL';
        break;
      case '2':
        colorClass = 'bg-success';
        genericStatusMessage = 'SUCCESS';
        break;
      case '3':
        colorClass = 'bg-surprise';
        genericStatusMessage = 'REDIRECTION';
        break;
      case '4':
        colorClass = 'bg-warning';
        genericStatusMessage = 'CLIENT ERROR';
        break;
      case '5':
        colorClass = 'bg-danger';
        genericStatusMessage = 'SERVER ERROR';
        break;
      case '0':
        colorClass = 'bg-danger';
        genericStatusMessage = 'ERROR';
        statusCodeToDisplay = '';
        break;
      default:
        colorClass = 'bg-surprise';
        genericStatusMessage = 'UNKNOWN';
        statusCodeToDisplay = '';
        break;
    }

    const description = RESPONSE_CODE_DESCRIPTIONS[statusCode] || 'Unknown Response Code';
    let msg = statusMessage || RESPONSE_CODE_REASONS[statusCodeToDisplay] || genericStatusMessage;

    return (
      <div className={classnames('tag', colorClass, {'tag--small': small})}>
        <Tooltip message={description} position="bottom">
          <strong>{statusCodeToDisplay}</strong> {msg.toUpperCase()}
        </Tooltip>
      </div>
    );
  }
}

export default StatusTag;
