import 'codemirror/addon/mode/simple';

import CodeMirror from 'codemirror';

/** regular key-value header tokens */
const keyValueHeaders = [
  {
    regex: /^(> )([^:]*:)(.*)$/,
    token: ['curl-prefix curl-out', 'curl-out', 'curl-out curl-value'],
  },
  {
    regex: /^(< )([^:]*:)(.*)$/,
    token: ['curl-prefix curl-in', 'curl-in', 'curl-in curl-value'],
  },
];

/**
 * @example POST /foo/bar HTTP/1.1
 */
const headerFields = [
  {
    regex: /^(> )([^:]+ .*)$/,
    token: ['curl-prefix curl-out curl-header', 'curl-out curl-header'],
  },
  {
    regex: /^(< )([^:]+ .*)$/,
    token: ['curl-prefix curl-in curl-header', 'curl-in curl-header'],
  },
];

const data = [
  {
    regex: /^(\| )(.*)$/,
    token: ['curl-prefix curl-data', 'curl-data'],
  },
];

const informationalText = [
  {
    regex: /^(\* )(.*)$/,
    token: ['curl-prefix curl-comment', 'curl-comment'],
  },
];

CodeMirror.defineSimpleMode('curl', {
  start: [
    ...keyValueHeaders,
    ...headerFields,
    ...data,
    ...informationalText,
  ],
  comment: [],
  meta: {},
});
