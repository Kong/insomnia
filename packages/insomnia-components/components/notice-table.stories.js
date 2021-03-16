// @flow
import * as React from 'react';
import NoticeTable from './notice-table';

export default { title: 'Tables | NoticeTable' };

const notices = [
  { type: 'error', line: 3, message: 'This must be fixed now!' },
  { type: 'warning', line: 10, message: 'This is a small nitpick' },
  {
    type: 'warning',
    line: 40,
    message: "Another small warning because you didn't the right thing",
  },
  {
    type: 'error',
    line: 3212,
    message:
      'This is a really, really, really, long error message and I hope it makes sense ' +
      "because it's just made up of random thoughts and things. But, don't let that fool you " +
      "it's really important and you should fix it as soon as possible!",
  },
];

export const _default = () => (
  <NoticeTable
    notices={notices}
    onClick={n => window.alert(n.message)}
    onVisibilityToggle={v => console.log('Visible?', v)}
  />
);

export const manyItems = () => {
  const notices = [];
  for (let i = 0; i < 100; i++) {
    notices.push({ type: 'error', line: i, message: 'This is message ' + i });
  }
  return (
    <NoticeTable
      notices={notices}
      onClick={n => window.alert(n.message)}
      onVisibilityToggle={v => console.log('Visible?', v)}
    />
  );
};
