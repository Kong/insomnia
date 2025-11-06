import type { Node } from '@react-types/shared';
import { useMenuSection, useSeparator } from 'react-aria';
import type { TreeState } from 'react-stately';

import { MenuItem } from './menu-item';

interface Props<T> {
  section: Node<T>;
  state: TreeState<T>;
  closeOnSelect?: boolean;
}

export const MenuSection = <T extends object>({ section, state, closeOnSelect = true }: Props<T>) => {
  const { itemProps, headingProps, groupProps } = useMenuSection({
    'heading': section.rendered,
    'aria-label': section['aria-label'],
  });

  const { separatorProps } = useSeparator({ elementType: 'li' });

  const shouldDisplayDivider = section.rendered || section.key !== state.collection.getFirstKey();

  return (
    <li {...itemProps}>
      <div className="mx-10 flex items-center">
        {section.rendered && (
          <span className="my-2 whitespace-nowrap bg-(--color-bg) pr-4 text-xs uppercase text-(--hl)" {...headingProps}>
            {section.rendered}
          </span>
        )}
        {shouldDisplayDivider && <hr className="my-1" {...separatorProps} />}
      </div>
      <ul {...groupProps} className="list-none p-0">
        {[...section.childNodes].map(
          (node: Node<T>) =>
            node.rendered && <MenuItem key={node.key} item={node} state={state} closeOnSelect={closeOnSelect} />,
        )}
      </ul>
    </li>
  );
};
