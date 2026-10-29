import classnames from 'classnames';
import type { RequestAccordionKeys } from 'insomnia-data';
import React, { type FC, type PropsWithChildren, useState } from 'react';

import { useAuthEditor } from '../use-auth-editor';

interface Props {
  label: string;
  accordionKey: RequestAccordionKeys;
}

export const AuthAccordion: FC<PropsWithChildren<Props>> = ({ accordionKey, label, children }) => {
  const { isExample, expandedAccordionKeys, patchMeta } = useAuthEditor();
  // Examples have no request meta, so their expansion stays local.
  const [exampleExpanded, setExampleExpanded] = useState(true);
  const expanded = isExample
    ? exampleExpanded
    : !expandedAccordionKeys || Boolean(expandedAccordionKeys[accordionKey]);
  const toggle = () => {
    if (isExample) {
      setExampleExpanded(current => !current);
      return;
    }
    patchMeta({
      expandedAccordionKeys: {
        ...expandedAccordionKeys,
        [accordionKey]: !expanded,
      },
    });
  };

  return (
    <>
      <tr>
        <td className="pad-top">
          <button onClick={toggle} className="faint">
            <i
              style={{
                minWidth: '0.8rem',
              }}
              className={classnames('fa fa--skinny', `fa-caret-${expanded ? 'down' : 'right'}`)}
            />
            {label}
          </button>
        </td>
      </tr>
      {expanded && children}
    </>
  );
};
