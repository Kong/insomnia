import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import * as session from '../../../account/session';
import { getAppVersion, getProductName } from '../../../common/constants';
import { selectSettings } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
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
  const [currentTabIndex, setCurrentTabIndex] = useState<number | null>(null);
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
        <Tabs className="react-tabs" defaultIndex={currentTabIndex ?? undefined}>
          <TabList>
            <Tab tabIndex="-1">
              <button value="General">General</button>
            </Tab>
            <Tab tabIndex="-1">
              <button value="Import/Export">Data</button>
            </Tab>
            <Tab tabIndex="-1">
              <button value="Themes">Themes</button>
            </Tab>
            <Tab tabIndex="-1">
              <button value="Shortcuts">Keyboard</button>
            </Tab>
            <Tab tabIndex="-1">
              <button value="Account">Account</button>
            </Tab>
            <Tab tabIndex="-1">
              <button value="Plugins">Plugins</button>
            </Tab>
          </TabList>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <General />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <ImportExport hideSettingsModal={() => modalRef.current?.hide()} />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <ThemePanel />
          </TabPanel>
          <TabPanel className="react-tabs__tab-panel pad scrollable">
            <Shortcuts />
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
SettingsModal.displayName = 'SettingsModal';
export const showSettingsModal = () => showModal(SettingsModal);
