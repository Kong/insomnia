import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/simple';

CodeMirror.defineSimpleMode('curl', {
  start: [
    {regex: /> .*/, token: 'curl-out'},
    {regex: /< .*/, token: 'curl-in'},
    {regex: /\* .*/, token: 'curl-comment'}
  ],
  comment: [
  ],
  meta: {
  }
});
