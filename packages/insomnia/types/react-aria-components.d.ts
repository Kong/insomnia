// `disallowTypeAhead` is missing from `ListBoxProps` typings in every published
// react-aria-components version (verified up to 1.21.1) even though the runtime fully
// supports it, and `GridListProps`/`TableProps` do declare it. Augment it here until
// upstream types it.
//
// Runtime evidence chain (adobe/react-spectrum, permalinks pinned to the commits our
// lockfile builds from):
// 1. ListBox spreads all props into the aria hook:
//    https://github.com/adobe/react-spectrum/blob/8df187370053aa35f553cb388ad670f65e1ab371/packages/react-aria-components/src/ListBox.tsx#L169 (useListBox({...props, ...}))
// 2. useListBox forwards props and merges the resulting handlers onto the listbox DOM element:
//    https://github.com/adobe/react-spectrum/blob/8df187370053aa35f553cb388ad670f65e1ab371/packages/%40react-aria/listbox/src/useListBox.ts#L79 (useSelectableList({...props})), #L118-L122 (listBoxProps mergeProps(..., listProps))
// 3. useSelectableList forwards props into useSelectableCollection:
//    https://github.com/adobe/react-spectrum/blob/8df187370053aa35f553cb388ad670f65e1ab371/packages/%40react-aria/selection/src/useSelectableList.ts#L75-L77
// 4. useSelectableCollection gates the typeahead handlers on `disallowTypeAhead`:
//    https://github.com/adobe/react-spectrum/blob/8df187370053aa35f553cb388ad670f65e1ab371/packages/%40react-aria/selection/src/useSelectableCollection.ts#L71 (#L118 default), #L571-L578 (if (!disallowTypeAhead) handlers = mergeProps(typeSelectProps, handlers))
// 5. Without it, useTypeSelect swallows the space key in the capture phase while its
//    search buffer is non-empty (within 1s of the last printable key):
//    https://github.com/adobe/react-spectrum/blob/8df187370053aa35f553cb388ad670f65e1ab371/packages/%40react-aria/selection/src/useTypeSelect.ts#L60-L68 (#L102 onKeyDownCapture)
//
// Even the latest published version at the time of writing (1.21.1, commit 4dd44e0)
// still lacks this prop in ListBoxProps — re-check the link below when upgrading, and
// delete this augmentation once upstream declares it:
//    https://github.com/adobe/react-spectrum/blob/4dd44e0f400636a87a9ad4390903e78c5ae6113c/packages/react-aria-components/src/ListBox.tsx
import 'react-aria-components';

declare module 'react-aria-components' {
  interface ListBoxProps<T> {
    disallowTypeAhead?: boolean;
  }
}
