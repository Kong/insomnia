import classnames from 'classnames';
import React, {PropTypes} from 'react';
import {
  RESPONSE_CODE_DESCRIPTIONS,
  STATUS_CODE_PEBKAC
} from '../../../common/constants';

const StatusTag = ({statusMessage, statusCode}) => {
  statusCode = String(statusCode);

  let colorClass;
  let backupStatusMessage;

  if (statusCode.startsWith('1')) {
    colorClass = 'bg-info';
    backupStatusMessage = 'INFO';
  } else if (statusCode.startsWith('2')) {
    colorClass = 'bg-success';
    backupStatusMessage = 'SUCCESS';
  } else if (statusCode.startsWith('3')) {
    colorClass = 'bg-surprise';
    backupStatusMessage = 'REDIRECT';
  } else if (statusCode.startsWith('4')) {
    colorClass = 'bg-warning';
    backupStatusMessage = 'INVALID';
  } else if (statusCode.startsWith('5')) {
    colorClass = 'bg-danger';
    backupStatusMessage = 'ERROR';
  } else if (statusCode.startsWith('0')) {
    colorClass = 'bg-danger';
    backupStatusMessage = 'ERROR';
    statusCode = '';  // Don't print a 0 status code
  } else if (statusCode === STATUS_CODE_PEBKAC.toString()) {
    colorClass = 'bg-danger';
    backupStatusMessage = 'PEBKAC\xa0\xa0٩◔̯◔۶';
    statusCode = '';  // Don't print status code
  } else {
    colorClass = 'bg-danger';
    backupStatusMessage = 'UNKNOWN';
  }

  const description = RESPONSE_CODE_DESCRIPTIONS[statusCode] || 'Unknown Response Code';

  return (
    <div className={classnames('tag', colorClass)} title={description}>
      <strong>{statusCode}</strong> {statusMessage || backupStatusMessage}
    </div>
  );
};

StatusTag.propTypes = {
  statusCode: PropTypes.number.isRequired,
  statusMessage: PropTypes.string
};

export default StatusTag;
