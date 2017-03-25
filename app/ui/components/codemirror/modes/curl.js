import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/simple';

CodeMirror.defineSimpleMode('curl', {
  start: [
    {regex: /^(>[^:]*:)(.*)$/, token: ['curl-out', 'curl-out curl-value']},
    {regex: /^(>)[^:]*$/, token: 'curl-out curl-header'},
    {regex: /^(<)[^:]*$/, token: 'curl-in curl-header'},
    {regex: /^(<[^:]*:)(.*)$/, token: ['curl-in', 'curl-in curl-value']},
    {regex: /^\*.*$/, token: 'curl-comment'}
  ],
  comment: [
  ],
  meta: {
  }
});
