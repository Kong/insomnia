import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/simple';

CodeMirror.defineSimpleMode('curl', {
  start: [
    // Regular key-value header tokens
    {regex: /^(>[^:]*:)(.*)$/, token: ['curl-out', 'curl-out curl-value']},
    {regex: /^(<[^:]*:)(.*)$/, token: ['curl-in', 'curl-in curl-value']},

    // Header fields ("POST /foo/bar HTTP/1.1")
    {regex: /^(>)[^:]*HTTP[^:]*$/, token: 'curl-out curl-header'},
    {regex: /^(<)[^:]*HTTP[^:]*$/, token: 'curl-in curl-header'},

    // Informational text
    {regex: /^\*.*$/, token: 'curl-comment'}
  ],
  comment: [],
  meta: {}
});
