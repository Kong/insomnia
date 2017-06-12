import classnames from 'classnames';
import React, {PropTypes} from 'react';
import {RESPONSE_CODE_DESCRIPTIONS, RESPONSE_CODE_REASONS, STATUS_CODE_RENDER_FAILED} from '../../../common/constants';

const StatusTag = ({statusMessage, statusCode, small}) => {
  statusCode = String(statusCode);

  let colorClass;
  let genericStatusMessage;

  if (statusCode.startsWith('1')) {
    colorClass = 'bg-info';
    genericStatusMessage = 'INFORMATIONAL';
  } else if (statusCode.startsWith('2')) {
    colorClass = 'bg-success';
    genericStatusMessage = 'SUCCESS';
  } else if (statusCode.startsWith('3')) {
    colorClass = 'bg-surprise';
    genericStatusMessage = 'REDIRECTION';
  } else if (statusCode.startsWith('4')) {
    colorClass = 'bg-warning';
    genericStatusMessage = 'CLIENT ERROR';
  } else if (statusCode.startsWith('5')) {
    colorClass = 'bg-danger';
    genericStatusMessage = 'SERVER ERROR';
  } else if (statusCode.startsWith('0')) {
    colorClass = 'bg-danger';
    genericStatusMessage = 'ERROR';
    statusCode = '';  // Don't print a 0 status code
  } else if (statusCode === STATUS_CODE_RENDER_FAILED.toString()) {
    colorClass = 'bg-danger';
    genericStatusMessage = 'Uh Oh!\xa0\xa0٩◔̯◔۶';
    statusCode = '';  // Don't print status code
  } else {
    colorClass = 'bg-danger';
    genericStatusMessage = 'UNKNOWN';
  }

  const description = RESPONSE_CODE_DESCRIPTIONS[statusCode] || 'Unknown Response Code';
  let message = statusMessage;
  if (!message) {
    message = RESPONSE_CODE_REASONS[statusCode] || genericStatusMessage;
  }

  return (
    <div className={classnames('tag', colorClass, {'tag--small': small})}
         title={description}>
      <strong>{statusCode}</strong> {message.toUpperCase()}
    </div>
  );
};

StatusTag.propTypes = {
  // Required
  statusCode: PropTypes.number.isRequired,

  // Optional
  small: PropTypes.bool,
  statusMessage: PropTypes.string
};

export default StatusTag;
