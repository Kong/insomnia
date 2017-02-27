import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/overlay';

CodeMirror.defineExtension('makeLinksClickable', function (handleClick) {
  // Only add the click mode if we have links to click
  const regexUrl = /^https?:\/\/([\da-z.\-]+)\.([a-z.]{2,6})([\/\w .\-+=;]*)*\/?/;

  this.addOverlay({
    token: function (stream, state) {
      if (stream.match(regexUrl, true)) {
        return 'clickable';
      }

      while (stream.next() != null) {
        if (stream.match(regexUrl, false)) break;
      }

      return null;
    }
  });

  this.getWrapperElement().addEventListener('click', e => {
    const cls = e.target.className;
    if (cls.indexOf('cm-clickable') >= 0) {
      handleClick(e.target.innerHTML);
    }
  });
});
