import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import * as session from '../../../account/session';
import { getAppVersion, getProductName } from '../../../common/constants';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { Account } from '../settings/account';
import { AI } from '../settings/ai';
import { General } from '../settings/general';
import { ImportExport } from '../settings/import-export';
import { Plugins } from '../settings/plugins';
import { Shortcuts } from '../settings/shortcuts';
import { ThemePanel } from '../settings/theme-panel';
import { Button } from '../themed-button';
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
  const modalRef = useRef<ModalHandle>(null);
  const email = session.isLoggedIn() ? session.getFullName() : null;

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      setDefaultTabKey(options?.tab || 'general');
      modalRef.current?.show();
    },
  }), []);
  const [_, refresh] = useState(0);
  let apiURL = 'https://api.insomnia.rest';
  let websiteURL = 'https://app.insomnia.rest';

  try {
    apiURL = window.localStorage.getItem('insomnia::api_url') || apiURL;
    websiteURL = window.localStorage.getItem('insomnia::website_url') || websiteURL;
  } catch (err) {
    console.log(err);
  }

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
          <TabItem key="account" title="Account">
            <PanelContainer className="pad">
              <Account />
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
          <TabItem key="dev" title="Dev">
            <PanelContainer className="pad">
              <form
                className='flex flex-col gap-3'
                onSubmit={e => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);

                  const apiURL = formData.get('apiURL') as string;
                  const websiteURL = formData.get('websiteURL') as string;

                  window.localStorage.setItem('insomnia::api_url', apiURL);
                  window.localStorage.setItem('insomnia::website_url', websiteURL);
                  refresh(_ + 1);
                }}
              >
                <label className="flex flex-col gap-2">
                  <span>API Url</span>
                  <input className='p-2 bg-[--hl-md] rounded' name="apiURL" type="url" defaultValue={apiURL} />
                </label>
                <label className="flex flex-col gap-2">
                  <span>Website Url</span>
                  <input className='p-2 bg-[--hl-md] rounded' name="websiteURL" type="url" defaultValue={websiteURL} />
                </label>
                <div>
                  <Button bg="surprise" variant='contained'>
                    Save
                  </Button>
                </div>
              </form>
            </PanelContainer>
          </TabItem>
        </Tabs>
      </ModalBody>
    </Modal>
  );
});
SettingsModal.displayName = 'SettingsModal';
export const showSettingsModal = () => showModal(SettingsModal);
