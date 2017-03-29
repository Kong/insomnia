import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/simple';

CodeMirror.defineSimpleMode('curl', {
  start: [
    // Regular key-value header tokens
    {regex: /^(> )([^:]*:)(.*)$/, token: ['curl-prefix curl-out', 'curl-out', 'curl-out curl-value']},
    {regex: /^(< )([^:]*:)(.*)$/, token: ['curl-prefix curl-in', 'curl-in', 'curl-in curl-value']},

    // Header fields ("POST /foo/bar HTTP/1.1")
    {regex: /^(> )([^:]*HTTP[^:]*)$/, token: ['curl-prefix curl-out', 'curl-out curl-header']},
    {regex: /^(< )([^:]*HTTP[^:]*)$/, token: ['curl-prefix curl-in', 'curl-in curl-header']},

    // Data
    {regex: /^(\| )(.*)$/, token: ['curl-prefix curl-data', 'curl-data']},

    // Informational text
    {regex: /^(\* )(.*)$/, token: ['curl-prefix curl-comment', 'curl-comment']}
  ],
  comment: [],
  meta: {}
});
