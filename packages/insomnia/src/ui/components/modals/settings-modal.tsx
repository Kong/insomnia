import { HotKeyRegistry } from 'insomnia-common';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import * as session from '../../../account/session';
import { getAppVersion, getProductName } from '../../../common/constants';
import * as models from '../../../models/index';
import { selectSettings } from '../../redux/selectors';
import { Button } from '../base/button';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { Account } from '../settings/account';
import { General } from '../settings/general';
import { ImportExport } from '../settings/import-export';
import { Plugins } from '../settings/plugins';
import { Shortcuts } from '../settings/shortcuts';
import { ThemePanel } from '../settings/theme-panel';
import { ModalHandle, registerModal, showModal } from './index';
export interface SettingsModalHandle extends ModalHandle {
  show(): void;
  show(currentTabIndex: number): void;
}

export const TAB_INDEX_EXPORT = 1;
export const TAB_INDEX_SHORTCUTS = 3;
export const TAB_INDEX_THEMES = 2;
export const TAB_INDEX_PLUGINS = 5;
export const SETTINGS_MODAL_DISPLAY_NAME = 'SettingsModal';
export const SettingsModal = forwardRef<SettingsModalHandle, ModalProps>((props, ref) => {
  const settings = useSelector(selectSettings);
  const [currentTabIndex, setCurrentTabIndex] = useState<number | null>(null);
  const modalRef = useRef<Modal>(null);
  const email = session.isLoggedIn() ? session.getFullName() : null;

  const handleUpdateKeyBindings = async (hotKeyRegistry: HotKeyRegistry) => {
    await models.settings.update(settings, {
      hotKeyRegistry,
    });
  };

  useEffect(() => {
    registerModal(modalRef.current, SETTINGS_MODAL_DISPLAY_NAME);
  }, []);

  useImperativeHandle(ref, () => ({
    hide(): void {
      modalRef.current?.hide();
    },
    show(currentTabIndex = 0): void {
      const tabIndex = typeof currentTabIndex !== 'number' ? 0 : currentTabIndex;
      setCurrentTabIndex(tabIndex);
      modalRef.current?.show();
    },
  }), []);

  return (
    <Modal ref={modalRef} tall freshState {...props}>
      <ModalHeader>
        {getProductName()} Preferences
        <span className="faint txt-sm">
            &nbsp;&nbsp;–&nbsp; v{getAppVersion()}
          {email ? ` – ${email}` : null}
        </span>
      </ModalHeader>
      <ModalBody noScroll>
        <Tabs className="react-tabs" defaultIndex={currentTabIndex ?? undefined}>
          <TabList>
            <Tab tabIndex="-1">
              <Button value="General">General</Button>
            </Tab>
            <Tab tabIndex="-1">
              <Button value="Import/Export">Data</Button>
            </Tab>
            <Tab tabIndex="-1">
              <Button value="Themes">Themes</Button>
            </Tab>
            <Tab tabIndex="-1">
              <Button value="Shortcuts">Keyboard</Button>
            </Tab>
            <Tab tabIndex="-1">
              <Button value="Account">Account</Button>
            </Tab>
            <Tab tabIndex="-1">
              <Button value="Plugins">Plugins</Button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <General />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <ImportExport hideSettingsModal={() => modalRef.current?.hide()}/>
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <ThemePanel />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <Shortcuts
              handleUpdateKeyBindings={handleUpdateKeyBindings}
            />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <Account />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <Plugins settings={settings} />
          </TabPanel>
        </Tabs>
      </ModalBody>
    </Modal>
  );
});
SettingsModal.displayName = SETTINGS_MODAL_DISPLAY_NAME;
export const showSettingsModal = () => showModal(SettingsModal);
