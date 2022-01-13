import classnames from 'classnames';
import React, { FC, useEffect } from 'react';
import { useToggle } from 'react-use';

interface Props {
  label: string;
}

const expandCache: Record<string, boolean> = {};

export const AuthAccordion: FC<Props> = ({ label, children }) => {
  const [expand, toggle] = useToggle(expandCache[label]);

  useEffect(() => {
    expandCache[label] = expand;
  }, [expand, label]);

  return (
    <>
      <tr>
        <td className="pad-top">
          <button onClick={toggle} className="faint">
            <i
              style={{
                minWidth: '0.8rem',
              }}
              className={classnames(
                'fa fa--skinny',
                `fa-caret-${expand ? 'down' : 'right'}`,
              )}
            />
            {label}
          </button>
        </td>
      </tr>
      {expand && children}
    </>
  );
};
