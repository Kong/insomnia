import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import * as session from '../../../account/session';
import { getAppVersion, getProductName } from '../../../common/constants';
import { selectSettings } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { Account } from '../settings/account';
import { General } from '../settings/general';
import { ImportExport } from '../settings/import-export';
import { Plugins } from '../settings/plugins';
import { Shortcuts } from '../settings/shortcuts';
import { ThemePanel } from '../settings/theme-panel';
import { showModal } from './index';

export interface SettingsModalHandle {
  hide: () => void;
  show: (options?: { tab?: number }) => void;
}

export const TAB_INDEX_EXPORT = 1;
export const TAB_INDEX_SHORTCUTS = 3;
export const TAB_INDEX_THEMES = 2;
export const TAB_INDEX_PLUGINS = 5;
export const SettingsModal = forwardRef<SettingsModalHandle, ModalProps>((props, ref) => {
  const settings = useSelector(selectSettings);
  const [, setCurrentTabIndex] = useState<number | null>(null);
  const modalRef = useRef<ModalHandle>(null);
  const email = session.isLoggedIn() ? session.getFullName() : null;

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      const tabIndex = typeof options?.tab !== 'number' ? 0 : options.tab;
      setCurrentTabIndex(tabIndex);
      modalRef.current?.show();
    },
  }), []);

  return (
    <Modal ref={modalRef} tall {...props}>
      <ModalHeader>
        {getProductName()} Preferences
        <span className="faint txt-sm">
          &nbsp;&nbsp;–&nbsp; v{getAppVersion()}
          {email ? ` – ${email}` : null}
        </span>
      </ModalHeader>
      <ModalBody noScroll>
        <Tabs aria-label="Insomnia Settings">
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
          <TabItem key="account" title="Account">
            <PanelContainer className="pad">
              <Account />
            </PanelContainer>
          </TabItem>
          <TabItem key="plugins" title="Plugins">
            <PanelContainer className="pad">
              <Plugins settings={settings} />
            </PanelContainer>
          </TabItem>
        </Tabs>
      </ModalBody>
    </Modal>
  );
});
SettingsModal.displayName = 'SettingsModal';
export const showSettingsModal = () => showModal(SettingsModal);
