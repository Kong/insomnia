import React, {PropTypes, PureComponent} from 'react';
import classnames from 'classnames';
import {RESPONSE_CODE_DESCRIPTIONS, RESPONSE_CODE_REASONS} from '../../../common/constants';

class StatusTag extends PureComponent {
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
        colorClass = 'bg-danger';
        genericStatusMessage = 'UNKNOWN';
        statusCodeToDisplay = '';
        break;
    }

    const description = RESPONSE_CODE_DESCRIPTIONS[statusCode] || 'Unknown Response Code';
    let msg = statusMessage || RESPONSE_CODE_REASONS[statusCodeToDisplay] || genericStatusMessage;

    return (
      <div className={classnames('tag', colorClass, {'tag--small': small})} title={description}>
        <strong>{statusCodeToDisplay}</strong> {msg.toUpperCase()}
      </div>
    );
  }
}

StatusTag.propTypes = {
  // Required
  statusCode: PropTypes.number.isRequired,

  // Optional
  small: PropTypes.bool,
  statusMessage: PropTypes.string
};

export default StatusTag;
