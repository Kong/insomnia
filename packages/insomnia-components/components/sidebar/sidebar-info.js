// @flow
import * as React from 'react';
import SidebarPanel from './sidebar-panel';
import SidebarItem from './sidebar-item';
import SidebarTextItem from './sidebar-text-item';

type Props = {
  info: Object,
  childrenVisible: boolean,
};

function SidebarInfo(props: Props) {
  const { title, description, version, license } = props.info;
  return (
    <SidebarPanel childrenVisible={props.childrenVisible}>
      {title && (
        <SidebarItem>
          <SidebarTextItem label={'Title:'} headline={title} />
        </SidebarItem>
      )}
      {description && (
        <SidebarItem>
          <SidebarTextItem label={'Description:'} headline={description} />
        </SidebarItem>
      )}
      {version && (
        <SidebarItem>
          <SidebarTextItem label={'Version:'} headline={version} />
        </SidebarItem>
      )}
      {license && license.name && (
        <SidebarItem>
          <SidebarTextItem label={'License:'} headline={license.name} />
        </SidebarItem>
      )}
    </SidebarPanel>
  );
}

export default SidebarInfo;
