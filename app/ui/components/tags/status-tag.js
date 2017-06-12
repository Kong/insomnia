import classnames from 'classnames';
import React, {PropTypes} from 'react';
import {RESPONSE_CODE_DESCRIPTIONS, STATUS_CODE_RENDER_FAILED} from '../../../common/constants';

const StatusTag = ({statusMessage, statusCode, small}) => {
  statusCode = String(statusCode);

  let colorClass;
  let backupStatusMessage;

  if (statusCode.startsWith('1')) {
    colorClass = 'bg-info';
    backupStatusMessage = 'INFORMATIONAL';
  } else if (statusCode.startsWith('2')) {
    colorClass = 'bg-success';
    backupStatusMessage = 'SUCCESS';
  } else if (statusCode.startsWith('3')) {
    colorClass = 'bg-surprise';
    backupStatusMessage = 'REDIRECTION';
  } else if (statusCode.startsWith('4')) {
    colorClass = 'bg-warning';
    backupStatusMessage = 'CLIENT ERROR';
  } else if (statusCode.startsWith('5')) {
    colorClass = 'bg-danger';
    backupStatusMessage = 'SERVER ERROR';
  } else if (statusCode.startsWith('0')) {
    colorClass = 'bg-danger';
    backupStatusMessage = 'ERROR';
    statusCode = '';  // Don't print a 0 status code
  } else if (statusCode === STATUS_CODE_RENDER_FAILED.toString()) {
    colorClass = 'bg-danger';
    backupStatusMessage = 'Uh Oh!\xa0\xa0٩◔̯◔۶';
    statusCode = '';  // Don't print status code
  } else {
    colorClass = 'bg-danger';
    backupStatusMessage = 'UNKNOWN';
  }

  const description = RESPONSE_CODE_DESCRIPTIONS[statusCode] || 'Unknown Response Code';
  const message = typeof statusMessage === 'string' ? statusMessage : backupStatusMessage;

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
