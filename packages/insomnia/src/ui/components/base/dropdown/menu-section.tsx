import type { Node } from '@react-types/shared';
import React from 'react';
import { useMenuSection, useSeparator } from 'react-aria';
import type { TreeState } from 'react-stately';

import { MenuItem } from './menu-item';

interface Props<T> {
  section: Node<T>;
  state: TreeState<T>;
  closeOnSelect?: boolean;
}

export const MenuSection = <T extends object>({
  section,
  state,
  closeOnSelect = true,
}: Props<T>) => {
  const { itemProps, headingProps, groupProps } = useMenuSection({
    heading: section.rendered,
    'aria-label': section['aria-label'],
  });

  const { separatorProps } = useSeparator({ elementType: 'li' });

  const shouldDisplayDivider = section.rendered || section.key !== state.collection.getFirstKey();

  return (
    <li {...itemProps}>
      <div className="flex items-center mx-10">
        {section.rendered && (
          <span
            className="whitespace-nowrap pr-4 text-[--hl] bg-[--color-bg] text-xs uppercase my-2"
            {...headingProps}
          >
            {section.rendered}
          </span>
        )}
        {shouldDisplayDivider && <hr className="my-1" {...separatorProps} />}
      </div>
      <ul {...groupProps} className="p-0 list-none">
        {[...section.childNodes].map((node: Node<T>) => (
          node.rendered && (
            <MenuItem
              key={node.key}
              item={node}
              state={state}
              closeOnSelect={closeOnSelect}
            />
          )
        ))}
      </ul>
    </li>
  );
};
