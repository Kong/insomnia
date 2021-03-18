// @flow
import * as React from 'react';
import SidebarPanel from './sidebar-panel';
import SidebarItem from './sidebar-item';
import SidebarTextItem from './sidebar-text-item';

type Props = {
  info: Object,
  childrenVisible: boolean,
  onClick: (section: string, ...args: Array<string>) => void,
};

function SidebarInfo(props: Props) {
  const { title, description, version, license } = props.info;

  return (
    <SidebarPanel childrenVisible={props.childrenVisible}>
      {title && (
        <SidebarItem onClick={() => props.onClick('info', 'title')}>
          <SidebarTextItem label={'Title:'} headline={title} />
        </SidebarItem>
      )}
      {description && (
        <SidebarItem onClick={() => props.onClick('info', 'description')}>
          <SidebarTextItem label={'Description:'} headline={description} />
        </SidebarItem>
      )}
      {version && (
        <SidebarItem onClick={() => props.onClick('info', 'version')}>
          <SidebarTextItem label={'Version:'} headline={version} />
        </SidebarItem>
      )}
      {license && license.name && (
        <SidebarItem onClick={() => props.onClick('info', 'license')}>
          <SidebarTextItem label={'License:'} headline={license.name} />
        </SidebarItem>
      )}
    </SidebarPanel>
  );
}

export default SidebarInfo;
