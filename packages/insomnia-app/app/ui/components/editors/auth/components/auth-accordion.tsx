import classnames from 'classnames';
import React, { FC } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../../../models';
import { isRequest } from '../../../../../models/request';
import { selectActiveRequest, selectActiveRequestMeta } from '../../../../redux/selectors';

interface Props {
  label: string;
}

export const AuthAccordion: FC<Props> = ({ label, children }) => {
  const activeRequest = useSelector(selectActiveRequest);
  const activeRequestMeta = useSelector(selectActiveRequestMeta);

  if (!activeRequest || !isRequest(activeRequest)) {
    return null;
  }

  const expanded = Boolean(activeRequestMeta?.expandedAccordionKeys[label]);

  const toggle = async () => {
    await models.requestMeta.updateOrCreateByParentId(activeRequest._id, {
      expandedAccordionKeys: {
        ...activeRequestMeta?.expandedAccordionKeys,
        [label]: !expanded,
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
              className={classnames(
                'fa fa--skinny',
                `fa-caret-${expanded ? 'down' : 'right'}`,
              )}
            />
            {label}
          </button>
        </td>
      </tr>
      {expanded && children}
    </>
  );
};
