import classnames from 'classnames';
import React, { FC, PropsWithChildren } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { RequestAccordionKeys } from '../../../../../models/request-meta';
import { useRequestMetaPatcher } from '../../../../hooks/use-request';
import { RequestLoaderData } from '../../../../routes/request';

interface Props {
  label: string;
  accordionKey: RequestAccordionKeys;
}

export const AuthAccordion: FC<PropsWithChildren<Props>> = ({ accordionKey, label, children }) => {
  const { activeRequest, activeRequestMeta } = useRouteLoaderData('request/:requestId') as RequestLoaderData;

  const expanded = Boolean(activeRequestMeta?.expandedAccordionKeys[accordionKey]);
  const patchRequestMeta = useRequestMetaPatcher();
  const toggle = async () => {
    patchRequestMeta(activeRequest._id, {
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
