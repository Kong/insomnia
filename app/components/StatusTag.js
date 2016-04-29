import classnames from 'classnames';
import React, {PropTypes} from 'react'

const StatusTag = ({statusMessage, statusCode}) => {
  statusCode = String(statusCode);

  let colorClass;
  let backupStatusMessage;

  if (statusCode.startsWith('1')) {
    colorClass = 'info';
    backupStatusMessage = 'INFO';
  } else if (statusCode.startsWith('2')) {
    colorClass = 'success';
    backupStatusMessage = 'SUCCESS';
  } else if (statusCode.startsWith('3')) {
    colorClass = 'surprise';
    backupStatusMessage = 'REDIRECT';
  } else if (statusCode.startsWith('4')) {
    colorClass = 'warning';
    backupStatusMessage = 'INVALID';
  } else if (statusCode.startsWith('5')) {
    colorClass = 'danger';
    backupStatusMessage = 'ERROR';
  } else {
    colorClass = 'info';
    backupStatusMessage = 'UNKNOWN';
  }

  return (
    <div className={classnames('tag', colorClass)}>
      <strong>{statusCode}</strong>&nbsp;{statusMessage || backupStatusMessage}
    </div>
  );
};

StatusTag.propTypes = {
  statusCode: PropTypes.number.isRequired,
  statusMessage: PropTypes.string
};

export default StatusTag;
