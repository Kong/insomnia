import React, { FunctionComponent } from 'react';
import { SidebarPanel } from './sidebar-panel';
import { SidebarItem } from './sidebar-item';
import { SidebarTextItem } from './sidebar-text-item';

export interface SidebarInfoType {
  title: string;
  description: string;
  version: string;
  license: {
    name: string;
  };
}

export interface SidebarInfoProps {
  info: SidebarInfoType;
  childrenVisible: boolean;
  onClick: (section: string, ...args: string[]) => void;
}

export const SidebarInfo: FunctionComponent<SidebarInfoProps> = ({
  info: {
    title,
    description,
    version,
    license,
  },
  childrenVisible,
  onClick,
}) => {
  return (
    <SidebarPanel childrenVisible={childrenVisible}>
      {title && (
        <SidebarItem onClick={() => onClick('info', 'title')}>
          <SidebarTextItem label={'Title:'} headline={title} />
        </SidebarItem>
      )}
      {description && (
        <SidebarItem onClick={() => onClick('info', 'description')}>
          <SidebarTextItem label={'Description:'} headline={description} />
        </SidebarItem>
      )}
      {version && (
        <SidebarItem onClick={() => onClick('info', 'version')}>
          <SidebarTextItem label={'Version:'} headline={version} />
        </SidebarItem>
      )}
      {license && license.name && (
        <SidebarItem onClick={() => onClick('info', 'license')}>
          <SidebarTextItem label={'License:'} headline={license.name} />
        </SidebarItem>
      )}
    </SidebarPanel>
  );
};
