// @flow
import * as React from 'react';
import SidebarItem from './sidebar-item';
import Tooltip from '../tooltip';
import SvgIcon, { IconEnum } from '../svg-icon';

type Props = {
  responses: Object,
  children?: React.Node,
  filter: string,
};

const SidebarResponses = ({ responses, filter, children }: Props) => (
  <React.Fragment>
    {Object.keys(responses).map(response => (
      <React.Fragment key={response}>
        {response.toLowerCase().includes(filter) && (
          <SidebarItem>
            <div></div>
            <div>
              <SvgIcon icon={IconEnum.indentation} />
            </div>
            <span>
              <Tooltip message={responses[response].description} position="right">
                {response}
              </Tooltip>
            </span>
          </SidebarItem>
        )}
      </React.Fragment>
    ))}
  </React.Fragment>
);

export default SidebarResponses;
