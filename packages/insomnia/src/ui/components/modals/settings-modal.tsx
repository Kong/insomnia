import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { getAppVersion, getProductName } from '../../../common/constants';
import { useRootLoaderData } from '../../routes/root';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { AI } from '../settings/ai';
import { General } from '../settings/general';
import { ImportExport } from '../settings/import-export';
import { Plugins } from '../settings/plugins';
import { Shortcuts } from '../settings/shortcuts';
import { ThemePanel } from '../settings/theme-panel';
import { showModal } from './index';

export interface SettingsModalHandle {
  hide: () => void;
  show: (options?: { tab?: string }) => void;
}

export const TAB_INDEX_EXPORT = 'data';
export const TAB_INDEX_SHORTCUTS = 'keyboard';
export const TAB_INDEX_THEMES = 'themes';
export const TAB_INDEX_PLUGINS = 'plugins';
export const TAB_INDEX_AI = 'ai';

export const SettingsModal = forwardRef<SettingsModalHandle, ModalProps>((props, ref) => {
  const [defaultTabKey, setDefaultTabKey] = useState('general');
  const { userSession } = useRootLoaderData();
  const modalRef = useRef<ModalHandle>(null);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      setDefaultTabKey(options?.tab || 'general');
      modalRef.current?.show();
    },
  }), []);

  return (
    <Modal className='!z-10' ref={modalRef} tall {...props}>
      <ModalHeader>
        {getProductName()} Preferences
        <span className="faint txt-sm">
          &nbsp;&nbsp;–&nbsp; v{getAppVersion()}
          {(userSession.id && userSession.email) ? ` – ${userSession.email}` : null}
        </span>
      </ModalHeader>
      <ModalBody noScroll>
        <Tabs aria-label="Insomnia Settings"  defaultSelectedKey={defaultTabKey}>
          <TabItem key="general" title="General">
            <PanelContainer className="pad">
              <General />
            </PanelContainer>
          </TabItem>
          <TabItem key="data" title="Data">
            <PanelContainer className="pad">
              <ImportExport hideSettingsModal={() => modalRef.current?.hide()} />
            </PanelContainer>
          </TabItem>
          <TabItem key="themes" title="Themes">
            <PanelContainer className="pad">
              <ThemePanel />
            </PanelContainer>
          </TabItem>
          <TabItem key="keyboard" title="Keyboard">
            <PanelContainer className="pad">
              <Shortcuts />
            </PanelContainer>
          </TabItem>
          <TabItem key="plugins" title="Plugins">
            <PanelContainer className="pad">
              <Plugins />
            </PanelContainer>
          </TabItem>
          <TabItem key="ai" title="AI">
            <PanelContainer className="pad">
              <AI />
            </PanelContainer>
          </TabItem>
        </Tabs>
      </ModalBody>
    </Modal>
  );
});
SettingsModal.displayName = 'SettingsModal';
export const showSettingsModal = () => showModal(SettingsModal);
