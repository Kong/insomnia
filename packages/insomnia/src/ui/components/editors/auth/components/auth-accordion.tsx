import classnames from 'classnames';
import React, { type FC, type PropsWithChildren } from 'react';

import type { RequestAccordionKeys } from '~/insomnia-data';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestMetaPatcher } from '~/ui/hooks/use-request';

interface Props {
  label: string;
  accordionKey: RequestAccordionKeys;
}

export const AuthAccordion: FC<PropsWithChildren<Props>> = ({ accordionKey, label, children }) => {
  const reqData = useRequestLoaderData() as RequestLoaderData;
  const expanded = !reqData || Boolean(reqData.activeRequestMeta?.expandedAccordionKeys[accordionKey]);
  const patchRequestMeta = useRequestMetaPatcher();
  const toggle = () => {
    reqData &&
      patchRequestMeta(reqData.activeRequest._id, {
        expandedAccordionKeys: {
          ...reqData.activeRequestMeta?.expandedAccordionKeys,
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
