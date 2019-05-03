import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/overlay';
import { AllHtmlEntities } from 'html-entities';
import { FLEXIBLE_URL_REGEX } from '../../../../common/constants';

const entities = new AllHtmlEntities();

CodeMirror.defineExtension('makeLinksClickable', function(handleClick) {
  // Only add the click mode if we have links to click
  this.addOverlay({
    token: function(stream, state) {
      if (stream.match(FLEXIBLE_URL_REGEX, true)) {
        return 'clickable';
      }

      while (stream.next() != null) {
        if (stream.match(FLEXIBLE_URL_REGEX, false)) break;
      }

      return null;
    },
  });

  const el = this.getWrapperElement();
  let movedDuringClick = false;

  el.addEventListener('mousemove', e => {
    movedDuringClick = true;
  });

  el.addEventListener('mousedown', e => {
    movedDuringClick = false;
  });

  el.addEventListener('mouseup', e => {
    if (movedDuringClick) {
      return;
    }

    const cls = e.target.className;
    if (cls.indexOf('cm-clickable') >= 0) {
      handleClick(entities.decode(e.target.innerHTML));
    }
  });
});
