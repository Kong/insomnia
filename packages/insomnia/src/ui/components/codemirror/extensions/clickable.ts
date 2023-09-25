import 'codemirror/addon/mode/overlay';

import CodeMirror, { CodeMirrorLinkClickCallback } from 'codemirror';
import { decode } from 'html-entities';

import { FLEXIBLE_URL_REGEX } from '../../../../common/constants';

CodeMirror.defineExtension('makeLinksClickable', function(this: CodeMirror.Editor, handleClick: CodeMirrorLinkClickCallback) {
  // Only add the click mode if we have links to click
  this.addOverlay({
    token: function(stream: any) {
      if (stream.match(FLEXIBLE_URL_REGEX, true)) {
        return 'clickable';
      }

      while (stream.next() != null) {
        if (stream.match(FLEXIBLE_URL_REGEX, false)) {
          break;
        }
      }

      return null;
    },
  });

  const el: HTMLElement = this.getWrapperElement();
  let movedDuringClick = false;
  el.addEventListener('mousemove', () => {
    movedDuringClick = true;
  });
  el.addEventListener('mousedown', () => {
    movedDuringClick = false;
  });
  el.addEventListener('mouseup', event => {
    if (movedDuringClick || !event.target) {
      return;
    }

    if (event.target instanceof HTMLElement) {
      const cls = event.target.className;

      if (cls.indexOf('cm-clickable') >= 0) {
        handleClick(decode(event.target.innerHTML));
      }
    }

  });
});
