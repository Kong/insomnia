import classnames from 'classnames';
import React, { FC, PropsWithChildren } from 'react';
import { useSelector } from 'react-redux';
import { useRouteLoaderData } from 'react-router-dom';

import * as models from '../../../../../models';
import { isRequest, Request } from '../../../../../models/request';
import { RequestAccordionKeys } from '../../../../../models/request-meta';
import { selectActiveRequestMeta } from '../../../../redux/selectors';

interface Props {
  label: string;
  accordionKey: RequestAccordionKeys;
}

export const AuthAccordion: FC<PropsWithChildren<Props>> = ({ accordionKey, label, children }) => {
  const activeRequest = useRouteLoaderData('request/:requestId') as Request;
  const activeRequestMeta = useSelector(selectActiveRequestMeta);

  if (!activeRequest || !isRequest(activeRequest)) {
    return null;
  }

  const expanded = Boolean(activeRequestMeta?.expandedAccordionKeys[accordionKey]);

  const toggle = async () => {
    await models.requestMeta.updateOrCreateByParentId(activeRequest._id, {
      expandedAccordionKeys: {
        ...activeRequestMeta?.expandedAccordionKeys,
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
