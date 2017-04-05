import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/overlay';
import {FLEXIBLE_URL_REGEX} from '../../../../common/constants';

CodeMirror.defineExtension('makeLinksClickable', function (handleClick) {
  // Only add the click mode if we have links to click
  this.addOverlay({
    token: function (stream, state) {
      if (stream.match(FLEXIBLE_URL_REGEX, true)) {
        return 'clickable';
      }

      while (stream.next() != null) {
        if (stream.match(FLEXIBLE_URL_REGEX, false)) break;
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
