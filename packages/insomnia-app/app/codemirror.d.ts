import 'codemirror';

interface InsomniaExtensions {
  isHintDropdownActive: () => boolean;
  closeHintDropdown: () => void;
}

declare module 'codemirror' {
  /* eslint-disable @typescript-eslint/no-empty-interface */
  interface Editor extends InsomniaExtensions {}
  interface EditorFromTextEditor extends InsomniaExtensions {}
  /* eslint-enable @typescript-eslint/no-empty-interface */
}
