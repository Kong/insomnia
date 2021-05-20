import 'codemirror';
import { HandleGetRenderContext, HandleRender } from './common/render';

type LinkClickCallback = (url: string) => void;

interface InsomniaExtensions {
  closeHintDropdown: () => void;
  enableNunjucksTags: (
    handleRender: HandleRender,
    handleGetRenderContext?: HandleGetRenderContext,
    isVariableUncovered?: boolean,
  ) => void;
  isHintDropdownActive: () => boolean;
  makeLinksClickable: (handleClick: LinkClickCallback) => void;
}

declare module 'codemirror' {
  type CodeMirrorLinkClickCallback = LinkClickCallback;

  /* eslint-disable @typescript-eslint/no-empty-interface */
  interface Editor extends InsomniaExtensions {}
  interface EditorFromTextEditor extends InsomniaExtensions {}
  /* eslint-enable @typescript-eslint/no-empty-interface */
}
