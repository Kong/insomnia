// @flow
import * as React from 'react';
import NoticeTable from './notice-table';

export default { title: 'NoticeTable' };

const notices = [
  { type: 'error', line: 3, message: 'This must be fixed now!' },
  { type: 'warning', line: 10, message: 'This is a small nitpick' },
  {
    type: 'warning',
    line: 40,
    message: 'Another small warning because you didn\'t the right thing',
  },
];

export const _default = () => <NoticeTable notices={notices} />;
